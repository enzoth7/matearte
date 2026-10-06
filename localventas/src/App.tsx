import { useEffect, useMemo, useState } from 'react'
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
  Gift,
  MagnifyingGlass,
  Package,
  Plus,
  Receipt,
  SignOut,
  UserCircle,
  Users,
} from '@phosphor-icons/react'
import { supabase } from './supabase'

type Page = 'register' | 'sales' | 'clients' | 'products'
type CatalogSort = 'sku' | 'price'
type SortDirection = 'asc' | 'desc'

type Sale = {
  id: string
  time: string
  customer: string
  initials: string
  product: string
  amount: number
  payment: string
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

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(value)

const skuCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

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
  const [authorizationError, setAuthorizationError] = useState('')
  const [activePage, setActivePage] = useState<Page>('register')
  const [sales, setSales] = useState(initialSales)
  const [dailyTotal, setDailyTotal] = useState(0)
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('')
  const [catalogSort, setCatalogSort] = useState<CatalogSort>('sku')
  const [catalogSortDirection, setCatalogSortDirection] = useState<SortDirection>('asc')
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
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
        return
      }
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
    let active = true

    const loadCatalog = async () => {
      setCatalogLoading(true)
      setCatalogError('')
      const { data, error } = await supabase
        .from('commerce_products')
        .select('id,name,category,category_code,published,commerce_variants(id,sku,name,base_price_minor,active,option_values)')
        .neq('category', 'sandbox')
        .order('name')

      if (!active) return
      if (error) {
        setCatalogError('No se pudo cargar el catálogo.')
        setCatalogLoading(false)
        return
      }

      const nextCatalog = ((data || []) as CatalogProduct[])
        .map((item) => ({ ...item, commerce_variants: [...(item.commerce_variants || [])].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true })) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      setCatalog(nextCatalog)
      setCatalogLoading(false)
    }

    void loadCatalog()
    return () => { active = false }
  }, [])

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sales
    return sales.filter((sale) => `${sale.customer} ${sale.product} ${sale.id}`.toLowerCase().includes(query))
  }, [sales, search])

  const catalogRows = useMemo(() => catalog
    .flatMap((item) => item.commerce_variants.map((variant) => ({ product: item, variant })))
    .sort((a, b) => skuCollator.compare(a.variant.sku, b.variant.sku)), [catalog])

  const catalogCategories = useMemo(() => Array.from(new Set(catalogRows.map(({ product }) => product.category_code || product.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')), [catalogRows])

  const filteredCatalogRows = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase()

    return catalogRows.filter(({ product, variant }) => {
      const category = product.category_code || product.category
      const matchesSearch = !query || `${product.name} ${variant.name} ${variant.sku} ${category}`.toLowerCase().includes(query)
      const matchesCategory = !catalogCategoryFilter || category === catalogCategoryFilter

      return matchesSearch && matchesCategory
    }).sort((a, b) => {
      const comparison = catalogSort === 'sku'
        ? skuCollator.compare(a.variant.sku, b.variant.sku)
        : a.variant.base_price_minor - b.variant.base_price_minor || skuCollator.compare(a.variant.sku, b.variant.sku)
      return catalogSortDirection === 'asc' ? comparison : -comparison
    })
  }, [catalogRows, catalogSearch, catalogCategoryFilter, catalogSort, catalogSortDirection])

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
          first_purchase_date: purchaseDate || todayIso,
          last_purchase_date: purchaseDate || todayIso,
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
    } else if (customerForSale) {
      const saleDate = purchaseDate || todayIso
      const customerChanges: { first_purchase_date?: string; last_purchase_date?: string } = {}
      if (!customerForSale.firstPurchaseDate || saleDate < customerForSale.firstPurchaseDate) customerChanges.first_purchase_date = saleDate
      if (!customerForSale.lastPurchaseDate || saleDate > customerForSale.lastPurchaseDate) customerChanges.last_purchase_date = saleDate

      if (Object.keys(customerChanges).length) {
        const { error } = await supabase.from('local_sales_customers').update(customerChanges).eq('id', customerForSale.id)
        if (error) {
          setCustomerError('No se pudo actualizar la fecha de compra del cliente. Intentá de nuevo.')
          setSaving(false)
          return
        }
        setCustomers((current) => current.map((customer) => customer.id === customerForSale?.id
          ? {
              ...customer,
              firstPurchaseDate: customerChanges.first_purchase_date || customer.firstPurchaseDate,
              lastPurchaseDate: customerChanges.last_purchase_date || customer.lastPurchaseDate,
            }
          : customer))
      }
    }

    const parsedPrice = Number(price) || 0
    const parsedQuantity = Number(quantity) || 1
    const amount = parsedPrice * parsedQuantity
    const now = new Date()
    const name = customerForSale?.name || 'Cliente sin registrar'
    const productName = selectedCatalogRow ? `${selectedCatalogRow.product.name} · ${selectedCatalogRow.variant.name}` : 'Producto sin seleccionar'
    const newSale: Sale = {
      id: `#${String(sales.length + 1).padStart(5, '0')}`,
      time: now.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }),
      customer: name,
      initials: initials(name),
      product: productName,
      amount,
      payment,
    }
    setSales((current) => [newSale, ...current])
    setDailyTotal((current) => current + amount)
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
                      <label className="wide">Producto y variante<select value={selectedVariantId} onChange={(event) => chooseVariant(event.target.value)} required><option value="">Seleccionar del catálogo</option>{catalogRows.filter(({ variant }) => variant.active).map(({ product: item, variant }) => <option key={variant.id} value={variant.id}>{item.name} · {variant.name} · Cód. {variant.sku}</option>)}</select></label>
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

            <section className="metrics" aria-label="Resumen de ventas de hoy">
              <article className="metric-card metric-featured"><div className="metric-icon"><ChartLineUp weight="bold" /></div><div><small className="metric-label">Total vendido</small><strong>{formatMoney(dailyTotal)}</strong></div></article>
              <article className="metric-card"><div className="metric-icon"><Receipt /></div><div><small className="metric-label">Ventas</small><strong>{sales.length}</strong></div></article>
              <article className="metric-card"><div className="metric-icon"><UserCircle /></div><div><small className="metric-label">Clientes registrados</small><strong>{customers.length}</strong></div></article>
              <article className="metric-card"><div className="metric-icon"><Bag /></div><div><small className="metric-label">Ticket promedio</small><strong>{formatMoney(sales.length ? dailyTotal / sales.length : 0)}</strong></div></article>
            </section>

            <section className="content-grid">
              <article className="panel sales-panel">
                <div className="panel-header">
                  <h2>Ventas recientes</h2>
                  <label className="search-box"><MagnifyingGlass /><small className="sr-only">Buscar venta</small><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente o producto" /></label>
                </div>
                <div className="sales-table-wrap">
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
                  {filteredSales.length === 0 && <div className="empty-search">Todavía no hay ventas registradas.</div>}
                </div>
              </article>

              <aside className="right-column">
                <article className="panel birthday-panel">
                  <div className="panel-title-row"><div className="small-icon"><Gift /></div><h2>Próximos cumpleaños</h2></div>
                  <div className="empty-birthdays">No hay cumpleaños registrados.</div>
                  <button className="link-button" type="button" onClick={() => changePage('clients')}>Ver clientes <ArrowRight /></button>
                </article>
              </aside>
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
            <header className="topbar"><h1>Productos</h1></header>
            <section className="panel catalog-panel">
              <div className="catalog-toolbar">
                <div className="catalog-summary">
                  <strong>{catalog.length} productos</strong>
                  <small>{filteredCatalogRows.length} variantes listadas</small>
                </div>
                <div className="catalog-filters">
                  <label className="search-box catalog-search"><MagnifyingGlass /><small className="sr-only">Buscar por SKU o producto</small><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Buscar por SKU o producto" /></label>
                  <label className="catalog-category-filter"><small className="sr-only">Filtrar por categoría</small><select value={catalogCategoryFilter} onChange={(event) => setCatalogCategoryFilter(event.target.value)}><option value="">Todas las categorías</option>{catalogCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                </div>
              </div>
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
                        <th aria-sort={catalogSort === 'price' ? (catalogSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="catalog-sort-button catalog-sort-price" type="button" onClick={() => toggleCatalogSort('price')}>Precio base {sortIcon('price')}</button></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalogRows.map(({ product: item, variant }) => (
                        <tr key={variant.id}>
                          <td><strong>{variant.sku}</strong></td>
                          <td>{item.name}</td>
                          <td>{variant.name}</td>
                          <td>{item.category_code || item.category}</td>
                          <td><strong>{formatMoney(variant.base_price_minor / 100)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredCatalogRows.length && <div className="catalog-status">No se encontraron productos.</div>}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App
