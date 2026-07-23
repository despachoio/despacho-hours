"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatDecimalHours } from "@/lib/format-hours";

type ContactType = "primary" | "billing" | "manager" | "general";

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string;
  phone: string | null;
  contact_type: ContactType;
  job_title: string | null;
  is_primary: boolean;
  is_active: boolean;
};

type ContactForm = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  contactType: ContactType;
  isPrimary: boolean;
};

type ProjectResource = {
  id: string;
  employee_id: string;
};

type Project = {
  id: string;
  name: string;
  project_code: string | null;
  status: string;
  purchased_hours: number;
  used_hours: number;
  remaining_hours: number;
  project_resources: ProjectResource[];
};

type Client = {
  id: string;
  name: string;
  status: string;
  client_contacts: Contact[];
  projects: Project[];
};

const EMPTY_CONTACT_FORM: ContactForm = {
  firstName: "",
  lastName: "",
  jobTitle: "",
  email: "",
  phone: "",
  contactType: "general",
  isPrimary: false,
};

function getContactName(contact: Contact) {
  return (
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    contact.name ||
    contact.email
  );
}

function contactBadge(contactType: ContactType) {
  switch (contactType) {
    case "billing":
      return "bg-blue-100 text-[#153E90] ring-blue-200";
    case "primary":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "manager":
      return "bg-violet-100 text-violet-700 ring-violet-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const [client, setClient] = useState<Client | null>(null);
  const [role, setRole] = useState("");
  const [editingClient, setEditingClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [updatingClientStatus, setUpdatingClientStatus] = useState(false);
  const [clientError, setClientError] = useState("");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] =
    useState<ContactForm>(EMPTY_CONTACT_FORM);
  const [contactError, setContactError] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const isAdmin = ["finance admin", "super admin", "admin"].includes(
    role.trim().toLowerCase(),
  );

  async function loadClient() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();
      setRole(profile?.role || "");
    }

    const { data, error } = await supabase
      .from("clients")
      .select(
        `
        *,
        client_contacts (*),
        projects (
          id,
          name,
          project_code,
          status,
          purchased_hours,
          used_hours,
          remaining_hours,
          project_resources (id, employee_id)
        )
      `,
      )
      .eq("id", clientId)
      .single();

    if (error) {
      console.error("Client load failed:", error);
      return;
    }

    setClient(data as Client);
    setClientName(data.name);
  }

  async function updateClient() {
    if (!clientName.trim()) return;
    const { error } = await supabase
      .from("clients")
      .update({ name: clientName.trim() })
      .eq("id", clientId);

    if (error) {
      console.error("Client update failed:", error);
      return;
    }
    setEditingClient(false);
    await loadClient();
  }

  async function updateClientStatus(nextStatus: "active" | "archived") {
    if (updatingClientStatus) return;
    const isActivating = nextStatus === "active";
    const confirmation = isActivating
      ? "Activate this client? Their existing contacts and historical records will remain attached."
      : "Deactivate this client? The client and all historical records will remain available in the Archived tab.";
    if (!confirm(confirmation)) return;

    setUpdatingClientStatus(true);
    setClientError("");
    const { error } = await supabase
      .from("clients")
      .update({ status: nextStatus })
      .eq("id", clientId);
    if (error) {
      console.error("Client status update failed:", error);
      setClientError(error.message);
      setUpdatingClientStatus(false);
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  function openAddContact() {
    setEditingContact(null);
    setContactForm(EMPTY_CONTACT_FORM);
    setContactError("");
    setContactModalOpen(true);
  }

  function openEditContact(contact: Contact) {
    setEditingContact(contact);
    setContactForm({
      firstName: contact.first_name || "",
      lastName: contact.last_name || "",
      jobTitle: contact.job_title || "",
      email: contact.email,
      phone: contact.phone || "",
      contactType: contact.contact_type,
      isPrimary: contact.is_primary,
    });
    setContactError("");
    setContactModalOpen(true);
  }

  async function saveContact() {
    const email = contactForm.email.trim();
    if (!email) {
      setContactError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setContactError("Enter a valid email address.");
      return;
    }

    setSavingContact(true);
    setContactError("");
    const { error } = await supabase.rpc("save_client_contact", {
      p_contact_id: editingContact?.id || null,
      p_client_id: clientId,
      p_first_name: contactForm.firstName || null,
      p_last_name: contactForm.lastName || null,
      p_job_title: contactForm.jobTitle || null,
      p_email: email,
      p_phone: contactForm.phone || null,
      p_contact_type: contactForm.contactType,
      p_is_primary: contactForm.isPrimary,
    });

    if (error) {
      setContactError(error.message);
      setSavingContact(false);
      return;
    }

    setSavingContact(false);
    setContactModalOpen(false);
    await loadClient();
  }

  async function deactivateContact(contact: Contact) {
    setContactError("");
    const { error } = await supabase
      .from("client_contacts")
      .update({ is_active: false, is_primary: false })
      .eq("id", contact.id)
      .eq("client_id", clientId);

    if (error) {
      setContactError(error.message);
      return;
    }
    await loadClient();
  }

  const stats = useMemo(() => {
    const projects = client?.projects || [];
    const teamIds = new Set<string>();
    for (const project of projects) {
      for (const resource of project.project_resources || []) {
        if (resource.employee_id) teamIds.add(resource.employee_id);
      }
    }

    return {
      projectCount: projects.length,
      teamCount: teamIds.size,
      purchasedHours: projects.reduce(
        (total, project) => total + Number(project.purchased_hours || 0),
        0,
      ),
      remainingHours: projects.reduce(
        (total, project) => total + Number(project.remaining_hours || 0),
        0,
      ),
    };
  }, [client]);

  useEffect(() => {
    // Existing dashboard page performs its initial Supabase load client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!client) return null;

  const isArchived =
    String(client.status || "")
      .trim()
      .toLowerCase() === "archived";

  const activeContacts = (client.client_contacts || []).filter(
    (contact) => contact.is_active !== false,
  );

  return (
    <main className="min-h-screen bg-[#f8fafc] px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/clients"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:-translate-x-0.5 hover:text-[#153E90]"
        >
          ← Back to Clients
        </Link>

        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-10">
            <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/60 blur-3xl" />
            <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row">
              <div>
                {editingClient ? (
                  <input
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-3xl font-bold text-white outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-400/20"
                  />
                ) : (
                  <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
                    {client.name}
                  </h1>
                )}
                <span
                  className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-bold capitalize ring-1 ${isArchived ? "bg-slate-400/15 text-slate-200 ring-slate-300/20" : "bg-emerald-400/15 text-emerald-200 ring-emerald-300/20"}`}
                >
                  {client.status}
                </span>
              </div>

              {isAdmin ? (
                <div className="flex flex-wrap justify-end gap-3">
                  {editingClient ? (
                    <>
                      <button
                        type="button"
                        data-shortcut-save
                        data-shortcut-primary
                        aria-keyshortcuts="Control+S Meta+S Control+Enter Meta+Enter"
                        onClick={updateClient}
                        className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClient(false);
                          setClientName(client.name);
                        }}
                        className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingClient(true)}
                      className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                    >
                      Edit Client
                    </button>
                  )}
                  <Link
                    href={`/projects/new?client=${client.id}`}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg transition hover:-translate-y-0.5"
                  >
                    + Project
                  </Link>
                  <button
                    type="button"
                    disabled={updatingClientStatus}
                    onClick={() =>
                      void updateClientStatus(
                        isArchived ? "active" : "archived",
                      )
                    }
                    className={`rounded-2xl border px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${isArchived ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20" : "border-amber-300/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"}`}
                  >
                    {updatingClientStatus
                      ? isArchived
                        ? "Activating..."
                        : "Deactivating..."
                      : isArchived
                        ? "Activate"
                        : "Deactivate"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {clientError ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              Unable to update client status: {clientError}
            </div>
          ) : null}

          <div className="relative z-10 -mt-9 grid grid-cols-2 gap-4 px-4 md:grid-cols-4 lg:px-6">
            {[
              ["Projects", stats.projectCount],
              ["Team Members", stats.teamCount],
              ["Purchased", stats.purchasedHours],
              ["Remaining", stats.remainingHours],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  {label}
                </p>
                <p className="mt-3 text-3xl font-bold text-slate-950">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#153E90]">
                  People
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  Client Contacts
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  The people behind this relationship.
                </p>
              </div>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={openAddContact}
                  className="rounded-xl bg-[#153E90] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#123578]"
                >
                  Add Contact
                </button>
              ) : null}
            </div>

            {contactError && !contactModalOpen ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {contactError}
              </p>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {activeContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-slate-950">
                        {getContactName(contact)}
                      </p>
                      {contact.job_title ? (
                        <p className="mt-1 text-sm text-slate-500">
                          {contact.job_title}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold capitalize ring-1 ${contactBadge(contact.contact_type)}`}
                      >
                        {contact.contact_type}
                      </span>
                      {contact.is_primary ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Primary
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <a
                      href={`mailto:${contact.email}`}
                      className="block break-all font-semibold text-slate-800 hover:text-[#153E90]"
                    >
                      {contact.email}
                    </a>
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="block text-slate-600 hover:text-slate-950"
                      >
                        {contact.phone}
                      </a>
                    ) : null}
                  </div>

                  {isAdmin ? (
                    <div className="mt-5 flex gap-2 border-t border-slate-200 pt-4 opacity-80 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openEditContact(contact)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deactivateContact(contact)}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Deactivate
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {activeContacts.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <p className="font-semibold text-slate-700">
                  No active contacts yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Add a primary or billing contact to strengthen this
                  relationship.
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#153E90]">
                Delivery Portfolio
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                Projects
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Service engagements and wallet health at a glance.
              </p>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {(client.projects || []).map((project) => (
                <div
                  key={project.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"
                >
                  <div className="p-5">
                    <div className="flex justify-between gap-4">
                      <div>
                        <Link
                          href={`/projects/${project.id}`}
                          className="block text-lg font-bold text-slate-950 hover:text-[#153E90]"
                        >
                          {project.project_code
                            ? `[${project.project_code}] `
                            : ""}
                          {project.name}
                        </Link>
                        <span
                          className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${
                            project.status === "active"
                              ? "bg-green-100 text-green-700"
                              : project.status === "archived"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-[#153E90] hover:text-[#153E90]"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 border-t border-slate-200 bg-white text-center">
                    <div className="p-4">
                      <span className="text-xs font-semibold text-slate-400">
                        Purchased
                      </span>
                      <b className="mt-1 block text-lg text-slate-900">
                        {formatDecimalHours(project.purchased_hours)}
                      </b>
                    </div>
                    <div className="border-x border-slate-200 p-4">
                      <span className="text-xs font-semibold text-slate-400">
                        Used
                      </span>
                      <b className="mt-1 block text-lg text-slate-900">
                        {formatDecimalHours(project.used_hours)}
                      </b>
                    </div>
                    <div className="p-4">
                      <span className="text-xs font-semibold text-slate-400">
                        Remaining
                      </span>
                      <b className="mt-1 block text-lg text-[#153E90]">
                        {formatDecimalHours(project.remaining_hours)}
                      </b>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {contactModalOpen ? (
        <ContactModal
          form={contactForm}
          setForm={setContactForm}
          editing={Boolean(editingContact)}
          error={contactError}
          saving={savingContact}
          onClose={() => setContactModalOpen(false)}
          onSave={saveContact}
        />
      ) : null}
    </main>
  );
}

function ContactModal({
  form,
  setForm,
  editing,
  error,
  saving,
  onClose,
  onSave,
}: {
  form: ContactForm;
  setForm: React.Dispatch<React.SetStateAction<ContactForm>>;
  editing: boolean;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  function update<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="relative overflow-hidden bg-[#0F172A] px-7 py-6 pr-16 text-white">
          <div className="absolute -right-12 -top-16 h-36 w-36 rounded-full bg-[#153E90]/60 blur-2xl" />
          <button
            type="button"
            data-shortcut-overlay-close
            onClick={onClose}
            disabled={saving}
            aria-label="Close contact modal"
            className="absolute right-6 top-6 z-10 flex h-9 w-9 items-center justify-center rounded-full text-2xl text-slate-300 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
          <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
            Client contact
          </p>
          <h2
            id="contact-modal-title"
            className="relative mt-2 text-2xl font-bold"
          >
            {editing ? "Edit Contact" : "Add Contact"}
          </h2>
        </div>

        <div className="grid gap-5 px-7 py-6 md:grid-cols-2">
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 md:col-span-2">
              {error}
            </p>
          ) : null}

          <ContactInput
            label="First Name"
            value={form.firstName}
            onChange={(value) => update("firstName", value)}
          />
          <ContactInput
            label="Last Name"
            value={form.lastName}
            onChange={(value) => update("lastName", value)}
          />
          <div className="md:col-span-2">
            <ContactInput
              label="Job Title"
              value={form.jobTitle}
              onChange={(value) => update("jobTitle", value)}
            />
          </div>
          <ContactInput
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(value) => update("email", value)}
          />
          <ContactInput
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(value) => update("phone", value)}
          />

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Contact Type
            </span>
            <select
              value={form.contactType}
              onChange={(event) => {
                const type = event.target.value as ContactType;
                setForm((current) => ({
                  ...current,
                  contactType: type,
                  isPrimary: type === "primary" ? true : current.isPrimary,
                }));
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
            >
              <option value="primary">Primary</option>
              <option value="billing">Billing</option>
              <option value="manager">Manager</option>
              <option value="general">General</option>
            </select>
          </label>

          <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(event) => update("isPrimary", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm font-semibold text-slate-700">
              Set as Primary
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            data-shortcut-save
            data-shortcut-primary
            aria-keyshortcuts="Control+S Meta+S Control+Enter Meta+Enter"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-[#153E90] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#123578] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Contact"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}
