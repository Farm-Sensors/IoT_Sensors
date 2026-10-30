import { CheckCircle2, ChevronRight, LayoutDashboard, Pencil, Plus, Search, Trash2, Users, XCircle } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonCard } from "../../components/SkeletonCard";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormDialog } from "../../components/FormDialog";
import { Field } from "../../components/Field";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { StatusBadge } from "../../components/StatusBadge";
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

  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const handleDelete = async (clientId: number) => {

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
      <div className="mb-6">
        <PageHeader
          title="Gestión de Clientes"
          subtitle="Administra los clientes del sistema"
          action={
            <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
              <Plus aria-hidden="true" className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </PillButton>
          }
        />
      </div>

      <BentoCard variant="light" className="mb-6 border border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Search aria-hidden="true" className="w-5 h-5 text-[var(--text-subtle)]" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Buscar clientes" className="min-h-[44px] flex-1 bg-transparent text-[var(--text-body)] placeholder:text-[var(--text-subtle)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-full px-2"
          />
        </div>
      </BentoCard>

      {error && (
        <div role="alert" className="mb-4 rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-text)]">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      <div className="hidden md:block">
        <BentoCard variant="light">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-strong)]">
                  <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Empresa</th>
                  <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Contacto</th>
                  <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Email</th>
                  <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Teléfono</th>
                  <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Estado</th>
                  <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-6"><SkeletonCard lines={2} showHeader={false} /></td></tr>
                ) : filteredClients.map((client, index) => {
                  const staggerClass = index === 0 ? 'animate-stagger-1' : index === 1 ? 'animate-stagger-2' : 'animate-stagger-3';
                  return (
                  <tr key={client.id} className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--hover-overlay)] transition-colors ${staggerClass}`}>
                    <td className="py-3 px-4 text-[var(--text-main)]">{client.company_name}</td>
                    <td className="py-3 px-4 text-[var(--text-main)]">{client.user?.full_name || "-"}</td>
                    <td className="py-3 px-4 text-[var(--text-subtle)]">{client.user?.email || "-"}</td>
                    <td className="py-3 px-4 text-[var(--text-subtle)]">{client.phone || "-"}</td>
                    <td className="py-3 px-4">
                      <StatusBadge tone={client.user?.is_active ? "active" : "danger"} icon={client.user?.is_active ? CheckCircle2 : XCircle}>{client.user?.is_active ? "Activo" : "Inactivo"}</StatusBadge>
                    </td>
                    <td className="py-3 px-4 flex justify-end gap-2">
                       <PillButton
                         variant="secondary"
                         className="px-3 py-1 text-xs"
                         onClick={() => openEditForm(client)}
                       >
                         Editar <Pencil aria-hidden="true" className="w-3 h-3 ml-1" />
                       </PillButton>
                       <Link to={`/admin/clientes/${client.id}/predios`}>
                         <PillButton variant="outline" className="px-3 py-1 text-xs">Predios <ChevronRight aria-hidden="true" className="w-3 h-3 ml-1" /></PillButton>
                       </Link>
                       <Link to={`/admin/clientes/${client.id}/dashboard`}>
                         <PillButton variant="outline" className="px-3 py-1 text-xs">Dashboard <LayoutDashboard aria-hidden="true" className="w-3 h-3 ml-1" /></PillButton>
                       </Link>
                       <PillButton
                         variant="outline"
                         className="px-3 py-1 text-xs border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                         onClick={() => setPendingDelete({ id: client.id, name: client.company_name })}
                       >
                         Borrar <Trash2 aria-hidden="true" className="w-3 h-3 ml-1" />
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
        {loading && <SkeletonCard lines={2} />}
        {!loading && filteredClients.length > 0 && filteredClients.map((client, index) => {
          const staggerClass = index === 0 ? 'animate-stagger-1' : index === 1 ? 'animate-stagger-2' : 'animate-stagger-3';
          return (
          <BentoCard key={client.id} variant="light" className={`p-4 ${staggerClass}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-[var(--text-main)] font-medium">{client.company_name}</h2>
                <p className="text-sm text-[var(--text-subtle)]">{client.user?.full_name}</p>
              </div>
              <StatusBadge tone={client.user?.is_active ? "active" : "danger"} icon={client.user?.is_active ? CheckCircle2 : XCircle}>{client.user?.is_active ? "Activo" : "Inactivo"}</StatusBadge>
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
                Editar <Pencil aria-hidden="true" className="w-4 h-4 ml-1" />
              </PillButton>
              <Link to={`/admin/clientes/${client.id}/predios`}>
                 <PillButton variant="outline" className="w-full justify-center">Ver Predios <ChevronRight aria-hidden="true" className="w-4 h-4 ml-1" /></PillButton>
              </Link>
              <Link to={`/admin/clientes/${client.id}/dashboard`}>
                 <PillButton variant="outline" className="w-full justify-center">Dashboard <LayoutDashboard aria-hidden="true" className="w-4 h-4 ml-1" /></PillButton>
              </Link>
            </div>
            <div className="mt-2">
              <PillButton
                variant="outline"
                className="w-full justify-center border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                onClick={() => setPendingDelete({ id: client.id, name: client.company_name })}
              >
                Borrar Cliente <Trash2 aria-hidden="true" className="w-4 h-4 ml-1" />
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

      {showEditForm && (<FormDialog open title="Editar Cliente" onClose={() => {
                    setShowEditForm(false);
                    setEditingClientId(null);
                  }}>
            <form className="space-y-4" onSubmit={handleUpdate}>
              <Field label="Nombre de la Empresa"><input required type="text" value={editFormData.company_name} onChange={e => setEditFormData({...editFormData, company_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <Field label="Nombre de Contacto"><input required type="text" value={editFormData.full_name} onChange={e => setEditFormData({...editFormData, full_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <Field label="Email"><input required type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <Field label="Teléfono / WhatsApp"><input type="tel" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <Field label="Dirección"><input type="text" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <div className="flex gap-3 pt-4">
                <PillButton variant="outline" className="flex-1 justify-center" onClick={() => {
                  setShowEditForm(false);
                  setEditingClientId(null);
                }} type="button">Cancelar</PillButton>
                <PillButton variant="primary" className="flex-1 justify-center" type="submit">Guardar Cambios</PillButton>
              </div>
            </form>
          </FormDialog>)}

      {showCreateForm && (<FormDialog open title="Nuevo Cliente" onClose={() => setShowCreateForm(false)}>
            <form className="space-y-4" onSubmit={handleCreate}>
              <Field label="Nombre de la Empresa"><input required type="text" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <Field label="Nombre de Contacto"><input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <Field label="Email"><input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <Field label="Contraseña (Temporal)"><input required type="password" minLength={6} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <Field label="Teléfono"><input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <Field label="Dirección (Opcional)"><input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" /></Field>
              <div className="flex gap-3 pt-4">
                <PillButton variant="outline" className="flex-1 justify-center" onClick={() => setShowCreateForm(false)} type="button">Cancelar</PillButton>
                <PillButton variant="primary" className="flex-1 justify-center" type="submit">Guardar</PillButton>
              </div>
            </form>
          </FormDialog>)}
      <ConfirmDialog
        open={pendingDelete !== null}
        variant="danger"
        title={`¿Eliminar el cliente ${pendingDelete?.name ?? ""}?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) void handleDelete(target.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />

    </div>
    </PageTransition>
  );
}
