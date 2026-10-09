import { ChevronRight, LayoutDashboard, Pencil, Plus, Search, Trash2, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";

import { EmptyState } from "../../components/EmptyState";

interface Client {
  id: number;
  company_name: string;
  phone: string | null;
  address: string | null;
  user: {
    email: string;
    full_name: string;
    is_active: boolean;
  };
}

export function ClientManagement() {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    email: "",
    full_name: "",
    password: "",
    phone: "",
    address: "",
  });

  const [editFormData, setEditFormData] = useState({
    company_name: "",
    email: "",
    full_name: "",
    phone: "",
    address: "",
  });

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/clients?per_page=100");
      setClients(res.data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error loading clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/clients", formData);
      setShowCreateForm(false);
      setFormData({
        company_name: "",
        email: "",
        full_name: "",
        password: "",
        phone: "",
        address: "",
      });
      fetchClients();
      showToast("Cliente creado de forma exitosa", "success");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Error creating client", "error");
    }
  };

  const openEditForm = (client: Client) => {
    setEditingClientId(client.id);
    setEditFormData({
      company_name: client.company_name || "",
      email: client.user?.email || "",
      full_name: client.user?.full_name || "",
      phone: client.phone || "",
      address: client.address || "",
    });
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClientId) {
      return;
    }

    try {
      await api.put(`/clients/${editingClientId}`, editFormData);
      setShowEditForm(false);
      setEditingClientId(null);
      fetchClients();
      showToast("Cliente actualizado", "success");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Error updating client", "error");
    }
  };

  const handleDelete = async (clientId: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este cliente?")) return;

    try {
      await api.delete(`/clients/${clientId}`);
      fetchClients();
      showToast("Cliente eliminado", "success");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Error deleting client", "error");
    }
  };

  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.company_name.toLowerCase().includes(term) ||
      (c.user?.email || "").toLowerCase().includes(term) ||
      (c.phone || "").toLowerCase().includes(term)
    );
  });

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)] mb-2">Gestión de Clientes</h1>
          <p className="text-[var(--text-subtle)]">Administra los clientes del sistema</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cliente
        </PillButton>
      </div>

      <BentoCard variant="light" className="mb-6 border border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-[var(--text-subtle)]" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-[var(--text-body)] placeholder:text-[var(--text-subtle)]/70 focus:outline-none"
          />
        </div>
      </BentoCard>

      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger)]">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      <div className="hidden md:block">
        <BentoCard variant="light">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-strong)]">
                  <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Empresa</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Contacto</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Email</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Teléfono</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Estado</th>
                  <th scope="col" className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-6 text-center text-[var(--text-subtle)]">Cargando...</td></tr>
                ) : filteredClients.map((client, index) => {
                  const staggerClass = index === 0 ? 'animate-stagger-1' : index === 1 ? 'animate-stagger-2' : 'animate-stagger-3';
                  return (
                  <tr key={client.id} className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--hover-overlay)] transition-colors ${staggerClass}`}>
                    <td className="py-3 px-4 text-[var(--text-main)]">{client.company_name}</td>
                    <td className="py-3 px-4 text-[var(--text-main)]">{client.user?.full_name || "-"}</td>
                    <td className="py-3 px-4 text-[var(--text-subtle)]">{client.user?.email || "-"}</td>
                    <td className="py-3 px-4 text-[var(--text-subtle)]">{client.phone || "-"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${client.user?.is_active ? "bg-[var(--status-active-bg)] text-[var(--status-active)] border-[var(--status-active)]/30" : "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger)]/30"}`}>
                        {client.user?.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex justify-end gap-2">
                       <PillButton
                         variant="secondary"
                         className="px-3 py-1 text-xs"
                         onClick={() => openEditForm(client)}
                       >
                         Editar <Pencil className="w-3 h-3 ml-1" />
                       </PillButton>
                       <Link to={`/admin/clientes/${client.id}/predios`}>
                         <PillButton variant="outline" className="px-3 py-1 text-xs">Predios <ChevronRight className="w-3 h-3 ml-1" /></PillButton>
                       </Link>
                       <Link to={`/admin/clientes/${client.id}/dashboard`}>
                         <PillButton variant="outline" className="px-3 py-1 text-xs">Dashboard <LayoutDashboard className="w-3 h-3 ml-1" /></PillButton>
                       </Link>
                       <PillButton
                         variant="outline"
                         className="px-3 py-1 text-xs border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                         onClick={() => handleDelete(client.id)}
                       >
                         Borrar <Trash2 className="w-3 h-3 ml-1" />
                       </PillButton>
                    </td>
                  </tr>
                )})}
                {!loading && filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 px-4">
                      <EmptyState
                        icon={Users}
                        title="Sin clientes registrados"
                        description="Comienza creando un nuevo cliente para acceder a predios y sensores."
                        action={{
                          label: "Crear primer cliente",
                          onClick: () => setShowCreateForm(true),
                        }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading && <div className="text-center py-4">Cargando...</div>}
        {!loading && filteredClients.length > 0 && filteredClients.map((client, index) => {
          const staggerClass = index === 0 ? 'animate-stagger-1' : index === 1 ? 'animate-stagger-2' : 'animate-stagger-3';
          return (
          <BentoCard key={client.id} variant="light" className={`p-4 ${staggerClass}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-[var(--text-main)] font-medium">{client.company_name}</h3>
                <p className="text-sm text-[var(--text-subtle)]">{client.user?.full_name}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs border ${client.user?.is_active ? "bg-[var(--status-active-bg)] text-[var(--status-active)] border-[var(--status-active)]/30" : "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger)]/30"}`}>
                {client.user?.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div className="space-y-1 mb-4">
              <p className="text-sm text-[var(--text-subtle)]">{client.user?.email}</p>
              <p className="text-sm text-[var(--text-subtle)]">{client.phone || "Sin teléfono"}</p>
            </div>
            <div className="flex gap-2">
              <PillButton
                variant="secondary"
                className="flex-1 justify-center"
                onClick={() => openEditForm(client)}
              >
                Editar <Pencil className="w-4 h-4 ml-1" />
              </PillButton>
              <Link to={`/admin/clientes/${client.id}/predios`}>
                 <PillButton variant="outline" className="w-full justify-center">Ver Predios <ChevronRight className="w-4 h-4 ml-1" /></PillButton>
              </Link>
              <Link to={`/admin/clientes/${client.id}/dashboard`}>
                 <PillButton variant="outline" className="w-full justify-center">Dashboard <LayoutDashboard className="w-4 h-4 ml-1" /></PillButton>
              </Link>
            </div>
            <div className="mt-2">
              <PillButton
                variant="outline"
                className="w-full justify-center border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                onClick={() => handleDelete(client.id)}
              >
                Borrar Cliente <Trash2 className="w-4 h-4 ml-1" />
              </PillButton>
            </div>
          </BentoCard>
        )})}
        {!loading && filteredClients.length === 0 && (
          <EmptyState
            icon={Users}
            title="Sin clientes registrados"
            description="Comienza creando un nuevo cliente para acceder a predios y sensores."
            action={{
              label: "Crear primer cliente",
              onClick: () => setShowCreateForm(true),
            }}
          />
        )}
      </div>

      {showEditForm && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md max-h-[90vh] overflow-y-auto border border-[var(--border-strong)]">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-serif text-[var(--text-title)]">Editar Cliente</h2>
               <button
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingClientId(null);
                  }}
                  type="button"
                  className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
            </div>
            <form className="space-y-4" onSubmit={handleUpdate}>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Nombre de la Empresa</label>
                <input required type="text" value={editFormData.company_name} onChange={e => setEditFormData({...editFormData, company_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Nombre de Contacto</label>
                <input required type="text" value={editFormData.full_name} onChange={e => setEditFormData({...editFormData, full_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Email</label>
                <input required type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Teléfono / WhatsApp</label>
                <input type="tel" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Dirección</label>
                <input type="text" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div className="flex gap-3 pt-4">
                <PillButton variant="outline" className="flex-1 justify-center" onClick={() => {
                  setShowEditForm(false);
                  setEditingClientId(null);
                }} type="button">Cancelar</PillButton>
                <PillButton variant="primary" className="flex-1 justify-center" type="submit">Guardar Cambios</PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md max-h-[90vh] overflow-y-auto border border-[var(--border-strong)]">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-serif text-[var(--text-title)]">Nuevo Cliente</h2>
               <button onClick={() => setShowCreateForm(false)} type="button" className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] transition-colors"><XCircle className="w-6 h-6" /></button>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Nombre de la Empresa</label>
                <input required type="text" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Nombre de Contacto</label>
                <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Contraseña (Temporal)</label>
                <input required type="password" minLength={6} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Teléfono</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-1">Dirección (Opcional)</label>
                <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div className="flex gap-3 pt-4">
                <PillButton variant="outline" className="flex-1 justify-center" onClick={() => setShowCreateForm(false)} type="button">Cancelar</PillButton>
                <PillButton variant="primary" className="flex-1 justify-center" type="submit">Guardar</PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
