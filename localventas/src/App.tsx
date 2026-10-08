import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowsDownUp,
  Bag,
  CalendarBlank,
  CaretDown,
  CaretUp,
  ChartLineUp,
  Check,
  MagnifyingGlass,
  Package,
  PencilSimple,
  Plus,
  Receipt,
  SignOut,
  Trash,
  Users,
} from '@phosphor-icons/react'
import { supabase } from './supabase'

type Page = 'register' | 'sales' | 'clients' | 'products'
type CatalogSort = 'sku' | 'price'
type SortDirection = 'asc' | 'desc'
type SalesPeriod = 'today' | 'week' | 'month' | 'quarter'

type Sale = {
  id: string
  time: string
  soldOn: string
  createdAt: string
  customer: string
  initials: string
  product: string
  amount: number
  payment: string
}

type StoredSale = {
  sale_number: number
  customer_name: string
  sold_on: string
  payment_method: string
  total_minor: number
  created_at: string
  local_sale_items: Array<{
    product_name: string
    variant_name: string
    quantity: number
  }>
}

type CatalogVariant = {
  id: string
  sku: string
  name: string
  base_price_minor: number
  active: boolean
  option_values?: Record<string, unknown>
}

type CatalogProduct = {
  id: string
  name: string
  category: string
  category_code?: string | null
  published: boolean
  commerce_variants: CatalogVariant[]
}

type CatalogTableRow = {
  product: CatalogProduct
  variant: CatalogVariant | null
}

type SaleLine = {
  id: string
  variantId: string
  sku: string
  productName: string
  variantName: string
  quantity: number
  unitPriceMinor: number
}

type CatalogCategory = {
  code: string
  label_es: string
  sort_order: number
}

type Customer = {
  id: string
  name: string
  email: string
  phone: string
  birthday: string
  firstPurchaseDate: string
  lastPurchaseDate: string
}

const initialSales: Sale[] = []
const SalesTrendChart = lazy(() => import('./SalesTrendChart'))

const salesPeriodOptions: Array<{ value: SalesPeriod; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Última semana' },
  { value: 'month', label: 'Último mes' },
  { value: 'quarter', label: 'Últimos 3 meses' },
]

const toLocalIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const startOfSalesPeriod = (period: SalesPeriod, today: Date) => {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (period === 'week') start.setDate(start.getDate() - 6)
  if (period === 'month' || period === 'quarter') {
    const monthsBack = period === 'month' ? 1 : 3
    const targetMonth = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1)
    const lastDayOfTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
    start.setFullYear(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(today.getDate(), lastDayOfTargetMonth))
  }
  return toLocalIsoDate(start)
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(value)

const formatShortDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1].slice(-2)}` : value
}

const skuCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

const productSlug = (name: string) => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 120) || `producto-${Date.now()}`

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '—'

const mapCustomer = (row: { id: string; full_name: string; email: string | null; phone: string | null; birth_date: string | null; first_purchase_date: string | null; last_purchase_date: string | null }): Customer => ({
  id: row.id,
  name: row.full_name,
  email: row.email || '',
  phone: row.phone || '',
  birthday: row.birth_date || '',
  firstPurchaseDate: row.first_purchase_date || '',
  lastPurchaseDate: row.last_purchase_date || '',
})

const mapSale = (row: StoredSale): Sale => ({
  id: `#${String(row.sale_number).padStart(5, '0')}`,
  time: new Date(row.created_at).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }),
  soldOn: row.sold_on,
  createdAt: row.created_at,
  customer: row.customer_name,
  initials: initials(row.customer_name),
  product: row.local_sale_items.map((item) => `${item.product_name} · ${item.variant_name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`).join(', '),
  amount: row.total_minor / 100,
  payment: row.payment_method,
})

function StaffLogin({ onSession }: { onSession: (session: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const value = username.trim().toLowerCase()
    const loginEmail = value === 'user' ? 'user@matearte.uy' : value
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    setBusy(false)
    if (loginError) {
      setError('No se pudo iniciar sesión. Revisá el usuario y la contraseña.')
      return
    }
    if (data.session) onSession(data.session)
  }

  return (
    <main className="staff-login">
      <form className="staff-login-card" onSubmit={handleLogin}>
        <img src="/logo-matearte.avif" alt="Matearte" />
        <small>Gestión segura del local</small>
        <h1>Ingresar</h1>
        <div className="login-description">Usá la misma cuenta interna de Matearte.</div>
        {error && <div className="login-error" role="alert">{error}</div>}
        <label>Usuario o correo<input type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </main>
  )
}

function App() {
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const todayLabel = new Intl.DateTimeFormat('es-UY', { day: 'numeric', month: 'long', year: 'numeric' }).format(today)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [canCreateProducts, setCanCreateProducts] = useState(false)
  const [authorizationError, setAuthorizationError] = useState('')
  const [activePage, setActivePage] = useState<Page>('register')
  const [sales, setSales] = useState(initialSales)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState('')
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('today')
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [registerProductSearch, setRegisterProductSearch] = useState('')
  const [showRegisterProductResults, setShowRegisterProductResults] = useState(false)
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('')
  const [catalogSort, setCatalogSort] = useState<CatalogSort>('sku')
  const [catalogSortDirection, setCatalogSortDirection] = useState<SortDirection>('asc')
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductCategory, setNewProductCategory] = useState('')
  const [newProductSku, setNewProductSku] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('')
  const [newProductBusy, setNewProductBusy] = useState(false)
  const [newProductError, setNewProductError] = useState('')
  const [catalogNotice, setCatalogNotice] = useState('')
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [payment, setPayment] = useState('Efectivo')
  const [saleItems, setSaleItems] = useState<SaleLine[]>([])
  const [depositAmount, setDepositAmount] = useState('')
  const [itemsError, setItemsError] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(todayIso)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editCustomerEmail, setEditCustomerEmail] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
  const [editCustomerBirthday, setEditCustomerBirthday] = useState('')
  const [editCustomerBusy, setEditCustomerBusy] = useState(false)
  const [editCustomerError, setEditCustomerError] = useState('')

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setAuthorized(null)
      setCanCreateProducts(false)
      setAuthorizationError('')
      return
    }
    let active = true
    const verifyStaff = async () => {
      setAuthorized(null)
      setAuthorizationError('')
      const [pricingMembership, commerceMembership] = await Promise.all([
        supabase.from('admin_users').select('user_id').eq('user_id', session.user.id).eq('active', true).maybeSingle(),
        supabase.from('commerce_admin_users').select('user_id').eq('user_id', session.user.id).eq('active', true).maybeSingle(),
      ])
      if (!active) return
      if (pricingMembership.error && commerceMembership.error) {
        setAuthorizationError('No se pudo comprobar el acceso interno.')
        setAuthorized(false)
        setCanCreateProducts(false)
        return
      }
      setCanCreateProducts(Boolean(commerceMembership.data))
      setAuthorized(Boolean(pricingMembership.data || commerceMembership.data))
    }
    void verifyStaff()
    return () => { active = false }
  }, [session])

  useEffect(() => {
    if (!authorized) return
    let active = true
    const loadCustomers = async () => {
      setCustomersLoading(true)
      setCustomerError('')
      const { data, error } = await supabase
        .from('local_sales_customers')
        .select('id,full_name,email,phone,birth_date,first_purchase_date,last_purchase_date')
        .order('full_name')
      if (!active) return
      setCustomersLoading(false)
      if (error) {
        setCustomerError('No se pudo cargar la base de clientes.')
        return
      }
      setCustomers((data || []).map(mapCustomer))
    }
    void loadCustomers()
    return () => { active = false }
  }, [authorized])

  useEffect(() => {
    if (!authorized) return
    let active = true
    const loadSales = async () => {
      setSalesLoading(true)
      setSalesError('')
      const loadedSales: StoredSale[] = []
      const oldestRequiredDate = startOfSalesPeriod('quarter', today)
      let offset = 0
      let loadError = null
      while (true) {
        const { data, error } = await supabase
          .from('local_sales')
          .select('sale_number,customer_name,sold_on,payment_method,total_minor,created_at,local_sale_items(product_name,variant_name,quantity)')
          .gte('sold_on', oldestRequiredDate)
          .order('created_at', { ascending: false })
          .range(offset, offset + 999)
        if (error) {
          loadError = error
          break
        }
        const page = (data || []) as StoredSale[]
        loadedSales.push(...page)
        if (page.length < 1000) break
        offset += 1000
      }
      if (!active) return
      setSalesLoading(false)
      if (loadError) {
        setSalesError('No se pudo cargar el historial de ventas.')
        return
      }
      setSales(loadedSales.map(mapSale))
    }
    void loadSales()
    return () => { active = false }
  }, [authorized])

  useEffect(() => {
    if (!authorized) return
    let active = true

    const loadCatalog = async () => {
      setCatalogLoading(true)
      setCatalogError('')
      const [productsRequest, categoriesRequest] = await Promise.all([
        supabase
          .from('commerce_products')
          .select('id,name,category,category_code,published,commerce_variants(id,sku,name,base_price_minor,active,option_values)')
          .neq('category', 'sandbox')
          .order('name'),
        supabase
          .from('commerce_categories')
          .select('code,label_es,sort_order')
          .eq('active', true)
          .order('sort_order')
          .order('label_es'),
      ])

      if (!active) return
      if (productsRequest.error || categoriesRequest.error) {
        setCatalogError('No se pudo cargar el catálogo.')
        setCatalogLoading(false)
        return
      }

      const nextCatalog = ((productsRequest.data || []) as CatalogProduct[])
        .map((item) => ({ ...item, commerce_variants: [...(item.commerce_variants || [])].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true })) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      setCatalog(nextCatalog)
      setCatalogCategories((categoriesRequest.data || []) as CatalogCategory[])
      setCatalogLoading(false)
    }

    void loadCatalog()
    return () => { active = false }
  }, [authorized])

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sales
    return sales.filter((sale) => `${sale.customer} ${sale.product} ${sale.id}`.toLowerCase().includes(query))
  }, [sales, search])

  const selectedPeriodLabel = salesPeriodOptions.find((option) => option.value === salesPeriod)?.label || 'Hoy'
  const periodStartIso = startOfSalesPeriod(salesPeriod, today)
  const periodSales = useMemo(() => sales.filter((sale) => sale.soldOn >= periodStartIso && sale.soldOn <= todayIso), [sales, periodStartIso, todayIso])
  const periodTotal = useMemo(() => periodSales.reduce((total, sale) => total + sale.amount, 0), [periodSales])

  const salesTrend = useMemo(() => {
    if (salesPeriod === 'today') {
      const totalsByHour = new Map<number, number>()
      periodSales.forEach((sale) => {
        const hour = new Date(sale.createdAt).getHours()
        totalsByHour.set(hour, (totalsByHour.get(hour) || 0) + sale.amount)
      })
      return Array.from({ length: today.getHours() + 1 }, (_, hour) => ({
        label: `${String(hour).padStart(2, '0')}:00`,
        amount: totalsByHour.get(hour) || 0,
      }))
    }

    const totalsByDate = new Map<string, number>()
    periodSales.forEach((sale) => totalsByDate.set(sale.soldOn, (totalsByDate.get(sale.soldOn) || 0) + sale.amount))
    const points: Array<{ label: string; amount: number }> = []
    const cursor = new Date(`${periodStartIso}T12:00:00`)
    const end = new Date(`${todayIso}T12:00:00`)
    while (cursor <= end) {
      const isoDate = toLocalIsoDate(cursor)
      points.push({
        label: new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: '2-digit' }).format(cursor),
        amount: totalsByDate.get(isoDate) || 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return points
  }, [periodSales, periodStartIso, salesPeriod, today, todayIso])

  const catalogRows = useMemo(() => catalog
    .flatMap((item) => item.commerce_variants.map((variant) => ({ product: item, variant })))
    .sort((a, b) => skuCollator.compare(a.variant.sku, b.variant.sku)), [catalog])

  const catalogTableRows = useMemo<CatalogTableRow[]>(() => catalog.flatMap<CatalogTableRow>((item) => (
    item.commerce_variants.length
      ? item.commerce_variants.map((variant) => ({ product: item, variant }))
      : [{ product: item, variant: null }]
  )), [catalog])

  const catalogCategoryLabels = useMemo(() => new Map(catalogCategories.map((category) => [category.code, category.label_es])), [catalogCategories])

  const registerCatalogRows = useMemo(() => {
    if (!selectedCategory) return []
    return catalogRows.filter(({ product, variant }) => (
      variant.active && (product.category_code || product.category) === selectedCategory
    ))
  }, [catalogRows, selectedCategory])

  const registerProductMatches = useMemo(() => {
    const query = normalizeSearchText(registerProductSearch.trim())
    if (!query) return []
    return catalogRows.filter(({ product, variant }) => (
      variant.active
      && normalizeSearchText(`${variant.sku} ${product.name} ${variant.name}`).includes(query)
    )).slice(0, 8)
  }, [catalogRows, registerProductSearch])

  const filteredCatalogRows = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase()

    return catalogTableRows.filter(({ product, variant }) => {
      const category = product.category_code || product.category
      const matchesSearch = !query || `${product.name} ${variant?.name || ''} ${variant?.sku || ''} ${category}`.toLowerCase().includes(query)
      const matchesCategory = !catalogCategoryFilter || category === catalogCategoryFilter

      return matchesSearch && matchesCategory
    }).sort((a, b) => {
      if (!a.variant && !b.variant) return a.product.name.localeCompare(b.product.name, 'es')
      if (!a.variant) return 1
      if (!b.variant) return -1
      const comparison = catalogSort === 'sku'
        ? skuCollator.compare(a.variant.sku, b.variant.sku)
        : a.variant.base_price_minor - b.variant.base_price_minor || skuCollator.compare(a.variant.sku, b.variant.sku)
      return catalogSortDirection === 'asc' ? comparison : -comparison
    })
  }, [catalogTableRows, catalogSearch, catalogCategoryFilter, catalogSort, catalogSortDirection])

  const toggleCatalogSort = (column: CatalogSort) => {
    if (catalogSort === column) {
      setCatalogSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setCatalogSort(column)
    setCatalogSortDirection('asc')
  }

  const sortIcon = (column: CatalogSort) => {
    if (catalogSort !== column) return <ArrowsDownUp aria-hidden="true" />
    return catalogSortDirection === 'asc' ? <CaretUp aria-hidden="true" /> : <CaretDown aria-hidden="true" />
  }

  const customerMatches = useMemo(() => {
    const query = customerSearch.trim().toLowerCase()
    if (!query) return []
    return customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(query))
  }, [customerSearch, customers])

  const selectedCatalogRow = catalogRows.find(({ variant }) => variant.id === selectedVariantId)
  const itemsTotalMinor = useMemo(() => saleItems.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0), [saleItems])
  const depositMinor = Math.round((Number(depositAmount) || 0) * 100)

  const changePage = (page: Page) => {
    setActivePage(page)
    if (page === 'register') setSaved(false)
  }

  const resetSaleForm = () => {
    setSelectedCategory('')
    setSelectedVariantId('')
    setPrice('')
    setRegisterProductSearch('')
    setShowRegisterProductResults(false)
    setQuantity('1')
    setPayment('Efectivo')
    setSaleItems([])
    setDepositAmount('')
    setItemsError('')
    setCustomerSearch('')
    setSelectedCustomerId('')
    setAddingCustomer(false)
    setCustomerName('')
    setEmail('')
    setPhone('')
    setBirthday('')
    setPurchaseDate(todayIso)
    setCustomerError('')
    setSaved(false)
  }

  const chooseCategory = (categoryCode: string) => {
    setSelectedCategory(categoryCode)
    setSelectedVariantId('')
    setPrice('')
    setRegisterProductSearch('')
    setShowRegisterProductResults(false)
  }

  const chooseVariant = (variantId: string) => {
    setSelectedVariantId(variantId)
    const row = catalogRows.find(({ variant }) => variant.id === variantId)
    setPrice(row ? String(row.variant.base_price_minor / 100) : '')
    setRegisterProductSearch(row ? `${row.variant.sku} · ${row.product.name}` : '')
    setShowRegisterProductResults(false)
    setItemsError('')
  }

  const chooseSearchedProduct = (row: { product: CatalogProduct; variant: CatalogVariant }) => {
    setSelectedCategory(row.product.category_code || row.product.category)
    setSelectedVariantId(row.variant.id)
    setPrice(String(row.variant.base_price_minor / 100))
    setRegisterProductSearch(`${row.variant.sku} · ${row.product.name}`)
    setShowRegisterProductResults(false)
    setItemsError('')
  }

  const choosePayment = (nextPayment: string) => {
    setPayment(nextPayment)
    if (nextPayment !== 'Seña') setDepositAmount('')
    setCustomerError('')
  }

  const addSaleItem = () => {
    const parsedPrice = Number(price)
    const parsedQuantity = Number(quantity)
    if (!selectedCatalogRow) {
      setItemsError('Seleccioná un producto para agregarlo a la venta.')
      return
    }
    if (price === '' || !Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 10000000) {
      setItemsError('Ingresá un precio válido.')
      return
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 1000) {
      setItemsError('La cantidad debe ser un número entre 1 y 1000.')
      return
    }

    const unitPriceMinor = Math.round(parsedPrice * 100)
    setSaleItems((current) => {
      const existing = current.find((item) => item.variantId === selectedCatalogRow.variant.id && item.unitPriceMinor === unitPriceMinor)
      if (existing) {
        return current.map((item) => item.id === existing.id
          ? { ...item, quantity: Math.min(1000, item.quantity + parsedQuantity) }
          : item)
      }
      return [...current, {
        id: crypto.randomUUID(),
        variantId: selectedCatalogRow.variant.id,
        sku: selectedCatalogRow.variant.sku,
        productName: selectedCatalogRow.product.name,
        variantName: selectedCatalogRow.variant.name,
        quantity: parsedQuantity,
        unitPriceMinor,
      }]
    })
    setSelectedVariantId('')
    setRegisterProductSearch('')
    setPrice('')
    setQuantity('1')
    setShowRegisterProductResults(false)
    setItemsError('')
  }

  const updateSaleItem = (id: string, changes: Partial<Pick<SaleLine, 'quantity' | 'unitPriceMinor'>>) => {
    setSaleItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
    setItemsError('')
  }

  const removeSaleItem = (id: string) => {
    setSaleItems((current) => current.filter((item) => item.id !== id))
    setItemsError('')
  }

  const chooseCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id)
    setCustomerSearch(customer.name)
    setCustomerName(customer.name)
    setEmail(customer.email)
    setPhone(customer.phone)
    setBirthday(customer.birthday)
    setAddingCustomer(false)
  }

  const closeNewProduct = () => {
    if (newProductBusy) return
    setShowNewProduct(false)
    setNewProductName('')
    setNewProductCategory('')
    setNewProductSku('')
    setNewProductPrice('')
    setNewProductError('')
  }

  const createProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newProductName.trim()
    const category = newProductCategory.trim().toLowerCase()
    const sku = newProductSku.trim().toUpperCase()
    const parsedPrice = Number(newProductPrice)

    if (!name || !category || !sku || newProductPrice === '' || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setNewProductError('Completá el nombre, la categoría, el SKU y un precio válido.')
      return
    }

    const priceMinor = Math.round(parsedPrice * 100)

    setNewProductBusy(true)
    setNewProductError('')
    setCatalogNotice('')

    const payload = {
      name,
      editorial_slug: productSlug(name),
      category,
      category_code: category,
      description: '',
      sale_mode: 'standard',
      peso: 0,
      published: false,
    }

    let result = await supabase
      .from('commerce_products')
      .insert(payload)
      .select('id,name,category,category_code,published')
      .single()

    if (result.error?.code === '23505') {
      result = await supabase
        .from('commerce_products')
        .insert({ ...payload, editorial_slug: `${payload.editorial_slug}-${crypto.randomUUID().slice(0, 8)}` })
        .select('id,name,category,category_code,published')
        .single()
    }

    if (result.error || !result.data) {
      setNewProductBusy(false)
      setNewProductError(result.error?.code === '42501'
        ? 'Tu usuario no tiene permiso para crear productos.'
        : 'No se pudo crear el producto. Intentá nuevamente.')
      return
    }

    const variantResult = await supabase
      .from('commerce_variants')
      .insert({
        product_id: result.data.id,
        sku,
        name: 'Venta local',
        price_minor: priceMinor,
        base_price_minor: priceMinor,
        currency: 'UYU',
        active: true,
        option_values: {},
      })
      .select('id,sku,name,base_price_minor,active,option_values')
      .single()

    if (variantResult.error || !variantResult.data) {
      await supabase.from('commerce_products').delete().eq('id', result.data.id)
      setNewProductBusy(false)
      setNewProductError(variantResult.error?.code === '23505'
        ? 'Ese SKU ya existe. Usá otro código.'
        : 'No se pudo crear el producto. Intentá nuevamente.')
      return
    }

    const createdProduct: CatalogProduct = { ...result.data, commerce_variants: [variantResult.data] }
    setCatalog((current) => [...current, createdProduct].sort((a, b) => a.name.localeCompare(b.name, 'es')))
    setCatalogSearch(name)
    setCatalogCategoryFilter('')
    setCatalogNotice('Producto disponible para registrar ventas del local. En Commerce Admin quedó sin publicar.')
    setShowNewProduct(false)
    setNewProductName('')
    setNewProductCategory('')
    setNewProductSku('')
    setNewProductPrice('')
    setNewProductBusy(false)
  }

  const beginCustomer = () => {
    setSelectedCustomerId('')
    setCustomerName(customerSearch.trim())
    setEmail('')
    setPhone('')
    setBirthday('')
    setAddingCustomer(true)
  }

  const beginEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer)
    setEditCustomerName(customer.name)
    setEditCustomerEmail(customer.email)
    setEditCustomerPhone(customer.phone)
    setEditCustomerBirthday(customer.birthday)
    setEditCustomerError('')
  }

  const closeEditCustomer = () => {
    if (editCustomerBusy) return
    setEditingCustomer(null)
    setEditCustomerError('')
  }

  const saveCustomerChanges = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingCustomer) return

    const name = editCustomerName.trim()
    if (!name) {
      setEditCustomerError('Ingresá el nombre del cliente.')
      return
    }

    setEditCustomerBusy(true)
    setEditCustomerError('')
    const { data, error } = await supabase
      .from('local_sales_customers')
      .update({
        full_name: name,
        email: editCustomerEmail.trim() || null,
        phone: editCustomerPhone.trim() || null,
        birth_date: editCustomerBirthday || null,
      })
      .eq('id', editingCustomer.id)
      .select('id,full_name,email,phone,birth_date,first_purchase_date,last_purchase_date')
      .single()

    setEditCustomerBusy(false)
    if (error) {
      setEditCustomerError(error.code === '23505'
        ? 'Ya existe otro cliente con ese correo.'
        : 'No se pudieron guardar los cambios. Intentá nuevamente.')
      return
    }

    const updatedCustomer = mapCustomer(data)
    setCustomers((current) => current
      .map((customer) => customer.id === updatedCustomer.id ? updatedCustomer : customer)
      .sort((a, b) => a.name.localeCompare(b.name, 'es')))
    setEditingCustomer(null)
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setCustomerError('')
    setItemsError('')

    if (!saleItems.length) {
      setItemsError('Agregá al menos un producto a la venta.')
      setSaving(false)
      return
    }
    if (saleItems.some((item) => item.quantity < 1 || item.quantity > 1000 || item.unitPriceMinor < 0 || item.unitPriceMinor > 1000000000)) {
      setItemsError('Revisá el precio y la cantidad de los productos agregados.')
      setSaving(false)
      return
    }
    if (payment === 'Seña' && (depositAmount === '' || !Number.isFinite(Number(depositAmount)) || depositMinor < 0 || depositMinor > 1000000000)) {
      setCustomerError('Ingresá el monto cobrado como seña.')
      setSaving(false)
      return
    }

    let customerForSale = customers.find((customer) => customer.id === selectedCustomerId)

    if (addingCustomer && customerName.trim()) {
      const { data, error } = await supabase
        .from('local_sales_customers')
        .insert({
          full_name: customerName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          birth_date: birthday || null,
          first_purchase_date: null,
          last_purchase_date: null,
        })
        .select('id,full_name,email,phone,birth_date,first_purchase_date,last_purchase_date')
        .single()

      if (error) {
        setCustomerError(error.code === '23505'
          ? 'Ya existe un cliente con ese correo. Buscalo y seleccionalo para guardar la venta.'
          : 'No se pudo guardar el cliente. Revisá los datos e intentá de nuevo.')
        setSaving(false)
        return
      }

      customerForSale = mapCustomer(data)
      const savedCustomer = customerForSale
      setCustomers((current) => [...current, savedCustomer].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setSelectedCustomerId(savedCustomer.id)
      setCustomerSearch(savedCustomer.name)
      setAddingCustomer(false)
    }

    const saleDate = purchaseDate || todayIso
    const chargedTotalMinor = payment === 'Seña' ? depositMinor : itemsTotalMinor
    const { data: saleResult, error: saleError } = await supabase.rpc('create_local_sale_with_items', {
      p_customer_id: customerForSale?.id || null,
      p_sold_on: saleDate,
      p_payment_method: payment,
      p_items: saleItems.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price_minor: item.unitPriceMinor,
      })),
      p_deposit_minor: payment === 'Seña' ? depositMinor : null,
    })

    if (saleError) {
      setCustomerError('No se pudo guardar la venta. Revisá los datos e intentá de nuevo.')
      setSaving(false)
      return
    }

    const savedSale = saleResult as { sale_number: number; created_at: string }
    const createdAt = new Date(savedSale.created_at)
    const name = customerForSale?.name || 'Cliente sin registrar'
    const productName = saleItems
      .map((item) => `${item.productName} · ${item.variantName}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`)
      .join(', ')
    const newSale: Sale = {
      id: `#${String(savedSale.sale_number).padStart(5, '0')}`,
      time: createdAt.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }),
      soldOn: saleDate,
      createdAt: savedSale.created_at,
      customer: name,
      initials: initials(name),
      product: productName,
      amount: chargedTotalMinor / 100,
      payment,
    }
    setSales((current) => [newSale, ...current])
    if (customerForSale) {
      setCustomers((current) => current.map((customer) => customer.id === customerForSale?.id
        ? {
            ...customer,
            firstPurchaseDate: !customer.firstPurchaseDate || saleDate < customer.firstPurchaseDate ? saleDate : customer.firstPurchaseDate,
            lastPurchaseDate: !customer.lastPurchaseDate || saleDate > customer.lastPurchaseDate ? saleDate : customer.lastPurchaseDate,
          }
        : customer))
    }
    setSaving(false)
    setSaved(true)
  }

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' })
  }

  if (!authReady) {
    return <main className="auth-state" aria-live="polite">Preparando el acceso seguro…</main>
  }

  if (!session) return <StaffLogin onSession={setSession} />

  if (authorized === null) {
    return <main className="auth-state" aria-live="polite">Comprobando permisos…</main>
  }

  if (!authorized) {
    return (
      <main className="staff-login">
        <section className="staff-login-card auth-denied">
          <img src="/logo-matearte.avif" alt="Matearte" />
          <h1>Acceso no habilitado</h1>
          <div>{authorizationError || 'Esta cuenta no pertenece al equipo autorizado de Matearte.'}</div>
          <button className="cancel-button" type="button" onClick={signOut}><SignOut />Cerrar sesión</button>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>

      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <img src="/logo-matearte.avif" alt="Matearte" />
          <div><strong>Matearte</strong><small>Gestión del local</small></div>
        </div>
        <nav>
          <button className={`nav-item ${activePage === 'register' ? 'active' : ''}`} type="button" onClick={() => changePage('register')}><Plus weight="bold" />Registrar</button>
          <button className={`nav-item ${activePage === 'sales' ? 'active' : ''}`} type="button" onClick={() => changePage('sales')}><Receipt />Ventas<small className="nav-count">{sales.length}</small></button>
          <button className={`nav-item ${activePage === 'clients' ? 'active' : ''}`} type="button" onClick={() => changePage('clients')}><Users />Clientes</button>
          <button className={`nav-item ${activePage === 'products' ? 'active' : ''}`} type="button" onClick={() => changePage('products')}><Package />Productos</button>
        </nav>
        <div className="sidebar-account">
          <small>{session.user.email}</small>
          <button type="button" onClick={signOut}><SignOut />Cerrar sesión</button>
        </div>
      </aside>

      <main id="contenido">
        {activePage === 'register' && (
          <>
            <header className="topbar register-topbar">
              <h1>Registrar venta</h1>
              <div className="today"><CalendarBlank /><div><small>Hoy</small><time dateTime={todayIso}>{todayLabel}</time></div></div>
            </header>

            {saved ? (
              <section className="panel success-state register-success" aria-live="polite">
                <div className="success-icon"><Check weight="bold" /></div>
                <h2>Venta registrada</h2>
                <div className="success-actions">
                  <button className="primary-button" type="button" onClick={resetSaleForm}><Plus weight="bold" />Registrar otra venta</button>
                  <button className="cancel-button" type="button" onClick={() => changePage('sales')}>Ver ventas</button>
                </div>
              </section>
            ) : (
              <form className="panel register-form" onSubmit={handleSave}>
                <div className="register-form-grid">
                  <section className="form-section">
                    <div className="section-heading"><strong className="step-number">1</strong><h2>¿Qué compró?</h2></div>
                    <div className="form-grid two-columns">
                      <div className="register-product-search wide">
                        <label>Buscar producto
                          <div className="register-product-search-input">
                            <MagnifyingGlass />
                            <input
                              value={registerProductSearch}
                              onFocus={() => { if (registerProductSearch.trim()) setShowRegisterProductResults(true) }}
                              onChange={(event) => {
                                setRegisterProductSearch(event.target.value)
                                setShowRegisterProductResults(Boolean(event.target.value.trim()))
                                setSelectedCategory('')
                                setSelectedVariantId('')
                                setPrice('')
                              }}
                              onKeyDown={(event) => { if (event.key === 'Escape') setShowRegisterProductResults(false) }}
                              placeholder="Escribí el nombre o código"
                              autoComplete="off"
                            />
                          </div>
                        </label>
                        {showRegisterProductResults && registerProductSearch.trim() && (
                          <div className="register-product-results">
                            {registerProductMatches.map((row) => (
                              <button key={row.variant.id} type="button" onClick={() => chooseSearchedProduct(row)}>
                                <strong>{row.variant.sku} · {row.product.name}</strong>
                                <small>{row.variant.name}</small>
                              </button>
                            ))}
                            {!registerProductMatches.length && <div>No se encontraron productos activos.</div>}
                          </div>
                        )}
                      </div>
                      <label className="wide">Categoría<select value={selectedCategory} onChange={(event) => chooseCategory(event.target.value)} disabled={catalogLoading}><option value="">{catalogLoading ? 'Cargando categorías…' : 'Seleccionar categoría'}</option>{catalogCategories.map((category) => <option key={category.code} value={category.code}>{category.label_es}</option>)}</select></label>
                      <label className="wide">Producto y variante<select value={selectedVariantId} onChange={(event) => chooseVariant(event.target.value)} disabled={!selectedCategory || catalogLoading}><option value="">{selectedCategory ? 'Seleccionar del catálogo' : 'Elegí una categoría primero'}</option>{registerCatalogRows.map(({ product: item, variant }) => <option key={variant.id} value={variant.id}>{variant.sku} · {item.name} · {variant.name}</option>)}</select></label>
                      <label className="price-field">Precio unitario<input type="number" min="0" max="10000000" inputMode="decimal" value={price} onChange={(event) => { setPrice(event.target.value); setItemsError('') }} /></label>
                      <label>Cantidad<input type="number" min="1" max="1000" inputMode="numeric" value={quantity} onChange={(event) => { setQuantity(event.target.value); setItemsError('') }} /></label>
                      <button className="add-sale-item-button wide" type="button" onClick={addSaleItem}><Plus weight="bold" />Agregar producto</button>
                    </div>
                    {itemsError && <div className="sale-items-error" role="alert">{itemsError}</div>}
                    <div className="sale-items" aria-live="polite">
                      <div className="sale-items-heading"><strong>Productos de la venta</strong><small>{saleItems.length ? `${saleItems.length} ${saleItems.length === 1 ? 'producto' : 'productos'}` : 'Todavía no agregaste productos'}</small></div>
                      {saleItems.map((item) => (
                        <article className="sale-item-card" key={item.id}>
                          <div className="sale-item-description"><strong>{item.sku} · {item.productName}</strong><small>{item.variantName}</small></div>
                          <label>Precio<input type="number" min="0" max="10000000" inputMode="decimal" value={item.unitPriceMinor / 100} onChange={(event) => updateSaleItem(item.id, { unitPriceMinor: Math.min(1000000000, Math.max(0, Math.round((Number(event.target.value) || 0) * 100))) })} /></label>
                          <label>Cantidad<input type="number" min="1" max="1000" inputMode="numeric" value={item.quantity} onChange={(event) => updateSaleItem(item.id, { quantity: Math.min(1000, Math.max(1, Math.trunc(Number(event.target.value) || 1))) })} /></label>
                          <button className="remove-sale-item" type="button" onClick={() => removeSaleItem(item.id)} aria-label={`Eliminar ${item.productName}`}><Trash /></button>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="form-section client-section">
                    <div className="section-heading"><strong className="step-number">2</strong><h2>Datos del cliente</h2></div>
                    <div className="customer-search-area">
                      <label className="customer-search-field">Buscar por nombre
                        <div className="customer-search-control">
                          <div className="customer-search-input"><MagnifyingGlass /><input value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setSelectedCustomerId(''); setAddingCustomer(false) }} placeholder="Nombre del cliente" /></div>
                          <button className="add-customer-button" type="button" onClick={beginCustomer} aria-label="Agregar cliente"><Plus weight="bold" /></button>
                        </div>
                      </label>
                      {customerSearch.trim() && !selectedCustomerId && !addingCustomer && (
                        <div className="customer-results">
                          {customerMatches.map((customer) => <button key={customer.id} type="button" onClick={() => chooseCustomer(customer)}><strong>{customer.name}</strong><small>{customer.email || customer.phone}</small></button>)}
                          {!customerMatches.length && <div>No se encontró el cliente. Usá + para agregarlo.</div>}
                        </div>
                      )}
                    </div>
                    {customerError && <div className="customer-form-error" role="alert">{customerError}</div>}
                    <label className="purchase-date-field">Fecha de compra<input type="date" max={todayIso} value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></label>
                    <div className="sale-payment-fields form-grid">
                      <label>Forma de pago<select value={payment} onChange={(event) => choosePayment(event.target.value)}><option>Efectivo</option><option>Débito</option><option>Crédito</option><option>Transferencia</option><option>Seña</option></select></label>
                      {payment === 'Seña' && <label className="price-field">Seña cobrada<input type="number" min="0" max="10000000" inputMode="decimal" value={depositAmount} onChange={(event) => { setDepositAmount(event.target.value); setCustomerError('') }} placeholder="Ingresá el monto" required /><small className="field-help">El valor completo de los productos queda registrado por separado.</small></label>}
                    </div>
                    {addingCustomer && (
                      <div className="form-grid two-columns client-fields">
                        <label className="wide">Nombre y apellido<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /></label>
                        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                        <label>Teléfono<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                        <label>Fecha de cumpleaños<input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} /></label>
                      </div>
                    )}
                  </section>
                </div>

                <footer className="register-form-footer">
                  <section className={`total-row ${payment === 'Seña' ? 'has-deposit' : ''}`}>
                    <div><small>{payment === 'Seña' ? 'Valor de los productos' : 'Total de la venta'}</small><strong>{formatMoney(itemsTotalMinor / 100)}</strong></div>
                    {payment === 'Seña' && <div><small>Seña cobrada</small><strong>{formatMoney(depositMinor / 100)}</strong></div>}
                  </section>
                  <button className="primary-button save-sale-button" type="submit" disabled={saving || !saleItems.length}><Check weight="bold" />{saving ? 'Guardando…' : 'Guardar venta'}</button>
                </footer>
              </form>
            )}
          </>
        )}

        {activePage === 'sales' && (
          <>
            <header className="topbar">
              <h1>Ventas del local</h1>
              <div className="header-actions">
                <div className="today"><CalendarBlank /><div><small>Hoy</small><time dateTime={todayIso}>{todayLabel}</time></div></div>
                <button className="primary-button" type="button" onClick={() => changePage('register')}><Plus weight="bold" />Registrar venta</button>
              </div>
            </header>

            <section className="sales-period-toolbar" aria-label="Período del resumen">
              <div><strong>Resumen de ventas</strong><small>{selectedPeriodLabel}</small></div>
              <label>Período<select value={salesPeriod} onChange={(event) => setSalesPeriod(event.target.value as SalesPeriod)}>{salesPeriodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </section>

            <section className="metrics" aria-label={`Resumen de ventas: ${selectedPeriodLabel}`}>
              <article className="metric-card metric-featured"><div className="metric-icon"><ChartLineUp weight="bold" /></div><div><small className="metric-label">Total vendido</small><strong>{formatMoney(periodTotal)}</strong></div></article>
              <article className="metric-card"><div className="metric-icon"><Receipt /></div><div><small className="metric-label">Ventas</small><strong>{periodSales.length}</strong></div></article>
              <article className="metric-card"><div className="metric-icon"><Bag /></div><div><small className="metric-label">Ticket promedio</small><strong>{formatMoney(periodSales.length ? periodTotal / periodSales.length : 0)}</strong></div></article>
            </section>

            <section className="panel sales-trend-panel" aria-labelledby="sales-trend-title">
              <div className="sales-trend-heading"><div><h2 id="sales-trend-title">Evolución de ventas</h2><small>Total vendido · {selectedPeriodLabel}</small></div></div>
              {periodSales.length === 0 ? <div className="chart-empty">No hay ventas registradas en este período.</div> : (
                <Suspense fallback={<div className="chart-empty" aria-live="polite">Preparando gráfico…</div>}>
                  <SalesTrendChart data={salesTrend} period={salesPeriod} periodLabel={selectedPeriodLabel} />
                </Suspense>
              )}
            </section>

            <section className="content-grid">
              <article className="panel sales-panel">
                <div className="panel-header">
                  <h2>Ventas recientes</h2>
                  <label className="search-box"><MagnifyingGlass /><small className="sr-only">Buscar venta</small><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente o producto" /></label>
                </div>
                <div className="sales-table-wrap">
                  {salesLoading && <div className="empty-search" aria-live="polite">Cargando ventas…</div>}
                  {salesError && <div className="empty-search catalog-error" role="alert">{salesError}</div>}
                  <table className="sales-table">
                    <thead><tr><th>ID</th><th>Fecha</th><th>Hora</th><th>Producto</th><th>Cliente</th><th>Medio de pago</th><th>Total</th></tr></thead>
                    <tbody>
                      {filteredSales.map((sale) => (
                        <tr key={sale.id}>
                          <td><strong>{sale.id}</strong></td>
                          <td>{formatShortDate(sale.soldOn)}</td>
                          <td><strong>{sale.time}</strong></td>
                          <td className="sale-product-cell" title={sale.product}>
                            <span className="sale-product-desktop">{sale.product}</span>
                            <span className="sale-product-mobile" aria-hidden="true">{`${sale.product.slice(0, 5)}${sale.product.length > 5 ? '...' : ''}`}</span>
                          </td>
                          <td><div className="customer-cell"><small className="customer-avatar">{sale.initials}</small><strong>{sale.customer}</strong></div></td>
                          <td><small className="payment-pill">{sale.payment}</small></td>
                          <td><strong>{formatMoney(sale.amount)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!salesLoading && !salesError && filteredSales.length === 0 && <div className="empty-search">Todavía no hay ventas registradas.</div>}
                </div>
              </article>

            </section>
          </>
        )}

        {activePage === 'clients' && (
          <>
            <header className="topbar"><h1>Clientes</h1><button className="primary-button" type="button" onClick={() => changePage('register')}><Plus weight="bold" />Registrar venta</button></header>
            <section className="panel clients-panel">
              <div className="clients-panel-header"><h2>Base de clientes</h2><small>{customers.length} registrados</small></div>
              {customersLoading && <div className="clients-status" aria-live="polite">Cargando clientes…</div>}
              {customerError && <div className="clients-status clients-error" role="alert">{customerError}</div>}
              {!customersLoading && !customerError && customers.length === 0 && <div className="clients-status">Todavía no hay clientes registrados. Se agregan desde Registrar.</div>}
              {!customersLoading && !customerError && customers.length > 0 && (
                <div className="clients-table-wrap">
                  <table className="clients-table">
                    <thead><tr><th>Nombre</th><th>Contacto</th><th>Cumpleaños</th><th>Última compra</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                    <tbody>{customers.map((customer) => (
                      <tr key={customer.id}>
                        <td><strong>{customer.name}</strong></td>
                        <td>
                          <div className="client-email" title={customer.email || undefined}>
                            <span className="client-email-desktop">{customer.email || 'Sin email'}</span>
                            <span className="client-email-mobile" aria-hidden="true">{customer.email ? `${customer.email.slice(0, 7)}${customer.email.length > 7 ? '...' : ''}` : 'Sin email'}</span>
                          </div>
                          <small>{customer.phone || 'Sin teléfono'}</small>
                        </td>
                        <td>{customer.birthday || '—'}</td>
                        <td>{customer.lastPurchaseDate || '—'}</td>
                        <td><button className="client-edit-button" type="button" onClick={() => beginEditCustomer(customer)} aria-label={`Editar datos de ${customer.name}`} title="Editar datos"><PencilSimple weight="bold" /></button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
            {editingCustomer && (
              <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditCustomer() }}>
                <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="edit-customer-title">
                  <div className="product-modal-header">
                    <div>
                      <h2 id="edit-customer-title">Editar datos</h2>
                      <div>Actualizá la información del cliente.</div>
                    </div>
                    <button className="modal-close" type="button" onClick={closeEditCustomer} aria-label="Cerrar">×</button>
                  </div>
                  <form onSubmit={(event) => void saveCustomerChanges(event)}>
                    <div className="product-modal-fields">
                      <label>Nombre y apellido<input autoFocus maxLength={120} value={editCustomerName} onChange={(event) => { setEditCustomerName(event.target.value); setEditCustomerError('') }} required /></label>
                      <div className="product-field-row">
                        <label>Email<input type="email" maxLength={320} value={editCustomerEmail} onChange={(event) => { setEditCustomerEmail(event.target.value); setEditCustomerError('') }} placeholder="Opcional" /></label>
                        <label>Teléfono<input type="tel" maxLength={40} value={editCustomerPhone} onChange={(event) => { setEditCustomerPhone(event.target.value); setEditCustomerError('') }} placeholder="Opcional" /></label>
                      </div>
                      <label>Cumpleaños<input type="date" min="1900-01-01" max={todayIso} value={editCustomerBirthday} onChange={(event) => { setEditCustomerBirthday(event.target.value); setEditCustomerError('') }} /></label>
                    </div>
                    {editCustomerError && <div className="product-modal-error" role="alert">{editCustomerError}</div>}
                    <div className="product-modal-actions">
                      <button className="cancel-button" type="button" onClick={closeEditCustomer} disabled={editCustomerBusy}>Cancelar</button>
                      <button className="primary-button" type="submit" disabled={editCustomerBusy}>{editCustomerBusy ? 'Guardando…' : 'Guardar cambios'}</button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </>
        )}

        {activePage === 'products' && (
          <>
            <header className="topbar">
              <h1>Productos</h1>
              <button className="primary-button" type="button" onClick={() => { setCatalogNotice(''); setShowNewProduct(true) }} disabled={!canCreateProducts} title={canCreateProducts ? undefined : 'Solo los administradores del catálogo pueden agregar productos'}><Plus weight="bold" />Agregar producto</button>
            </header>
            <section className="panel catalog-panel">
              <div className="catalog-toolbar">
                <div className="catalog-summary">
                  <strong>{catalog.length} productos</strong>
                  <small>{filteredCatalogRows.filter(({ variant }) => Boolean(variant)).length} variantes listadas</small>
                </div>
                <div className="catalog-filters">
                  <label className="search-box catalog-search"><MagnifyingGlass /><small className="sr-only">Buscar por SKU o producto</small><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Buscar por SKU o producto" /></label>
                  <label className="catalog-category-filter"><small className="sr-only">Filtrar por categoría</small><select value={catalogCategoryFilter} onChange={(event) => setCatalogCategoryFilter(event.target.value)}><option value="">Todas las categorías</option>{catalogCategories.map((category) => <option key={category.code} value={category.code}>{category.label_es}</option>)}</select></label>
                </div>
              </div>
              {catalogNotice && <div className="catalog-notice" role="status"><Check weight="bold" />{catalogNotice}</div>}
              {catalogLoading && <div className="catalog-status">Cargando catálogo…</div>}
              {catalogError && <div className="catalog-status catalog-error">{catalogError}</div>}
              {!catalogLoading && !catalogError && (
                <div className="catalog-table-wrap">
                  <table className="catalog-table">
                    <thead>
                      <tr>
                        <th aria-sort={catalogSort === 'sku' ? (catalogSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="catalog-sort-button" type="button" onClick={() => toggleCatalogSort('sku')}>SKU {sortIcon('sku')}</button></th>
                        <th>Producto</th>
                        <th>Variante</th>
                        <th>Categoría</th>
                        <th>Estado</th>
                        <th aria-sort={catalogSort === 'price' ? (catalogSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="catalog-sort-button catalog-sort-price" type="button" onClick={() => toggleCatalogSort('price')}>Precio base {sortIcon('price')}</button></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalogRows.map(({ product: item, variant }) => (
                        <tr key={variant?.id || item.id} className={!variant ? 'catalog-draft-row' : undefined}>
                          <td><strong>{variant?.sku || '—'}</strong></td>
                          <td>{item.name}</td>
                          <td>{variant?.name || 'Sin variantes'}</td>
                          <td>{catalogCategoryLabels.get(item.category_code || item.category) || item.category_code || item.category}</td>
                          <td><small className={`catalog-state ${variant?.active ? 'is-active' : 'is-inactive'}`}>{variant?.active ? 'Activo' : 'Inactivo'}</small></td>
                          <td><strong>{variant ? formatMoney(variant.base_price_minor / 100) : '—'}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredCatalogRows.length && <div className="catalog-status">No se encontraron productos.</div>}
                </div>
              )}
            </section>
            {showNewProduct && (
              <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeNewProduct() }}>
                <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="new-product-title">
                  <div className="product-modal-header">
                    <div>
                      <h2 id="new-product-title">Agregar producto</h2>
                      <div>Se guardará también en Commerce Admin.</div>
                    </div>
                    <button className="modal-close" type="button" onClick={closeNewProduct} aria-label="Cerrar">×</button>
                  </div>
                  <form onSubmit={(event) => void createProduct(event)}>
                    <div className="product-modal-fields">
                      <label>Nombre del producto<input autoFocus maxLength={160} value={newProductName} onChange={(event) => { setNewProductName(event.target.value); setNewProductError('') }} placeholder="Ej.: Mate imperial clásico" required /></label>
                      <label>Categoría<select value={newProductCategory} onChange={(event) => { setNewProductCategory(event.target.value); setNewProductError('') }} required><option value="">Elegí una categoría</option>{catalogCategories.map((category) => <option key={category.code} value={category.code}>{category.label_es}</option>)}</select></label>
                      <div className="product-field-row">
                        <label>SKU<input maxLength={80} value={newProductSku} onChange={(event) => { setNewProductSku(event.target.value); setNewProductError('') }} placeholder="Ej.: 205" required /></label>
                        <label>Precio base (UYU)<input type="number" min="0" step="0.01" value={newProductPrice} onChange={(event) => { setNewProductPrice(event.target.value); setNewProductError('') }} placeholder="0" required /></label>
                      </div>
                    </div>
                    {newProductError && <div className="product-modal-error" role="alert">{newProductError}</div>}
                    <div className="product-modal-actions">
                      <button className="cancel-button" type="button" onClick={closeNewProduct} disabled={newProductBusy}>Cancelar</button>
                      <button className="primary-button" type="submit" disabled={newProductBusy}>{newProductBusy ? 'Creando…' : 'Crear producto'}</button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
