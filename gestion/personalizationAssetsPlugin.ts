import type { Plugin } from "vite";
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const virtualAssetsId = 'virtual:personalization-assets'
const resolvedVirtualAssetsId = `\0${virtualAssetsId}`
const supportedImageExtensions = new Set(['.png', '.webp', '.svg', '.jpg', '.jpeg'])
const personalizationRoot = fileURLToPath(new URL('../visualizador/public/assets/personalizacion', import.meta.url))
const personalizationFolders = ['fleje', 'virola', 'iconos'] as const

function slugifyAssetName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function humanizeAssetName(value: string) {
  return value
    .replace(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÜÑ])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scanPersonalizationFolder(folder: typeof personalizationFolders[number]) {
  const directory = path.join(personalizationRoot, folder)
  const files: string[] = []

  const visit = (currentDirectory: string) => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const fullPath = path.join(currentDirectory, entry.name)
      if (entry.isDirectory()) visit(fullPath)
      else if (supportedImageExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath)
    }
  }

  visit(directory)

  return files
    .sort((left, right) => left.localeCompare(right, 'es'))
    .map((fullPath) => {
      const relativePath = path.relative(directory, fullPath)
      const extension = path.extname(relativePath)
      const relativeWithoutExtension = relativePath.slice(0, -extension.length)
      const fileNameWithoutExtension = path.basename(relativeWithoutExtension)
      const urlPath = relativePath.split(path.sep).map(encodeURIComponent).join('/')
      return {
        id: slugifyAssetName(relativeWithoutExtension),
        name: humanizeAssetName(fileNameWithoutExtension),
        src: `/assets/personalizacion/${folder}/${urlPath}`,
      }
    })
}

export function personalizationAssetsPlugin(): Plugin {
  const isPersonalizationImage = (filePath: string) => {
    const normalizedPath = path.resolve(filePath)
    const relativePath = path.relative(personalizationRoot, normalizedPath)
    return relativePath !== ''
      && !relativePath.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relativePath)
      && supportedImageExtensions.has(path.extname(normalizedPath).toLowerCase())
  }

  return {
    name: 'matearte-personalization-assets',
    resolveId(id) {
      return id === virtualAssetsId ? resolvedVirtualAssetsId : undefined
    },
    load(id) {
      if (id !== resolvedVirtualAssetsId) return undefined
      const assets = Object.fromEntries(
        personalizationFolders.map((folder) => [folder, scanPersonalizationFolder(folder)]),
      )
      return `export const personalizationAssets = ${JSON.stringify(assets)};`
    },
    generateBundle() {
      for (const [fileName, fullPath] of assetFiles()) this.emitFile({ type: "asset", fileName, source: readFileSync(fullPath) });
    },
    configureServer(server) {
      const files = new Map(assetFiles());
      server.middlewares.use((request, response, next) => {
        const name = decodeURIComponent((request.url || "").split("?")[0]).replace(/^\//, "");
        const file = files.get(name);
        if (!file) return next();
        const mime: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
        response.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
        response.end(readFileSync(file));
      });
      const directories = personalizationFolders.map((folder) => path.join(personalizationRoot, folder))
      server.watcher.add(directories)

      const refreshCatalog = (event: string, filePath: string) => {
        if (!['add', 'unlink'].includes(event) || !isPersonalizationImage(filePath)) return
        const virtualModule = server.moduleGraph.getModuleById(resolvedVirtualAssetsId)
        if (virtualModule) server.moduleGraph.invalidateModule(virtualModule)
        server.ws.send({ type: 'full-reload', path: '*' })
      }

      server.watcher.on('all', refreshCatalog)
      server.httpServer?.once('close', () => server.watcher.off('all', refreshCatalog))
    },
  }
}


function assetFiles(): Array<[string, string]> {
  const root = fileURLToPath(new URL("../visualizador/public/", import.meta.url));
  const result: Array<[string, string]> = [];
  const visit = (relative: string) => {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(name);
      else if (supportedImageExtensions.has(path.extname(name).toLowerCase())) result.push([name, path.join(root, name)]);
    }
  };
  ["assets/personalizacion", "assets/plantillas/virola", "assets2/personalizacion/viroladeapliques"].forEach(visit);
  return result;
}
