import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowRight,
  ArrowsDownUp,
  Bag,
  CalendarBlank,
  CaretDown,
  CaretUp,
  ChartLineUp,
  Check,
  MagnifyingGlass,
  Package,
  Plus,
  Receipt,
  SignOut,
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

const skuCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

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

  const changePage = (page: Page) => {
    setActivePage(page)
    if (page === 'register') setSaved(false)
  }

  const resetSaleForm = () => {
    setSelectedCategory('')
    setSelectedVariantId('')
    setPrice('')
    setQuantity('1')
    setPayment('Efectivo')
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
  }

  const chooseVariant = (variantId: string) => {
    setSelectedVariantId(variantId)
    const row = catalogRows.find(({ variant }) => variant.id === variantId)
    setPrice(row ? String(row.variant.base_price_minor / 100) : '')
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

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setCustomerError('')

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

    const parsedPrice = Number(price) || 0
    const parsedQuantity = Number(quantity) || 1
    const unitPriceMinor = Math.round(parsedPrice * 100)
    const amount = unitPriceMinor * parsedQuantity / 100
    const saleDate = purchaseDate || todayIso
    if (!selectedCatalogRow) {
      setCustomerError('Seleccioná un producto del catálogo.')
      setSaving(false)
      return
    }

    const { data: saleResult, error: saleError } = await supabase.rpc('create_local_sale', {
      p_customer_id: customerForSale?.id || null,
      p_sold_on: saleDate,
      p_payment_method: payment,
      p_variant_id: selectedCatalogRow.variant.id,
      p_quantity: parsedQuantity,
      p_unit_price_minor: unitPriceMinor,
    })

    if (saleError) {
      setCustomerError('No se pudo guardar la venta. Revisá los datos e intentá de nuevo.')
      setSaving(false)
      return
    }

    const savedSale = saleResult as { sale_number: number; created_at: string }
    const createdAt = new Date(savedSale.created_at)
    const name = customerForSale?.name || 'Cliente sin registrar'
    const productName = selectedCatalogRow ? `${selectedCatalogRow.product.name} · ${selectedCatalogRow.variant.name}` : 'Producto sin seleccionar'
    const newSale: Sale = {
      id: `#${String(savedSale.sale_number).padStart(5, '0')}`,
      time: createdAt.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }),
      soldOn: saleDate,
      createdAt: savedSale.created_at,
      customer: name,
      initials: initials(name),
      product: productName,
      amount,
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
                      <label className="wide">Categoría<select value={selectedCategory} onChange={(event) => chooseCategory(event.target.value)} disabled={catalogLoading} required><option value="">{catalogLoading ? 'Cargando categorías…' : 'Seleccionar categoría'}</option>{catalogCategories.map((category) => <option key={category.code} value={category.code}>{category.label_es}</option>)}</select></label>
                      <label className="wide">Producto y variante<select value={selectedVariantId} onChange={(event) => chooseVariant(event.target.value)} disabled={!selectedCategory || catalogLoading} required><option value="">{selectedCategory ? 'Seleccionar del catálogo' : 'Elegí una categoría primero'}</option>{registerCatalogRows.map(({ product: item, variant }) => <option key={variant.id} value={variant.id}>{item.name} · {variant.name} · Cód. {variant.sku}</option>)}</select></label>
                      <label className="price-field">Precio unitario<input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
                      <label>Cantidad<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
                      <label>Forma de pago<select value={payment} onChange={(event) => setPayment(event.target.value)}><option>Efectivo</option><option>Débito</option><option>Crédito</option><option>Transferencia</option></select></label>
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
                  <section className="total-row"><small>Total de la venta</small><strong>{formatMoney((Number(price) || 0) * (Number(quantity) || 1))}</strong></section>
                  <button className="primary-button save-sale-button" type="submit" disabled={saving}><Check weight="bold" />{saving ? 'Guardando…' : 'Guardar venta'}</button>
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
                    <thead><tr><th>Hora</th><th>Cliente</th><th>Producto</th><th>Pago</th><th>Total</th><th><small className="sr-only">Abrir</small></th></tr></thead>
                    <tbody>
                      {filteredSales.map((sale) => (
                        <tr key={sale.id}>
                          <td><strong>{sale.time}</strong><small>{sale.id}</small></td>
                          <td><div className="customer-cell"><small className="customer-avatar">{sale.initials}</small><strong>{sale.customer}</strong></div></td>
                          <td>{sale.product}</td>
                          <td><small className="payment-pill">{sale.payment}</small></td>
                          <td><strong>{formatMoney(sale.amount)}</strong></td>
                          <td><button className="row-action" type="button" aria-label={`Ver venta ${sale.id}`}><ArrowRight /></button></td>
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
                    <thead><tr><th>Nombre</th><th>Contacto</th><th>Cumpleaños</th><th>Última compra</th></tr></thead>
                    <tbody>{customers.map((customer) => (
                      <tr key={customer.id}>
                        <td><strong>{customer.name}</strong></td>
                        <td><div>{customer.email || 'Sin email'}</div><small>{customer.phone || 'Sin teléfono'}</small></td>
                        <td>{customer.birthday || '—'}</td>
                        <td>{customer.lastPurchaseDate || '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
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
