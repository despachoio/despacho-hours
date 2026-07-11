"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const [client, setClient] = useState<Client | null>(null);
  const [role, setRole] = useState("");
  const [editingClient, setEditingClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(EMPTY_CONTACT_FORM);
  const [contactError, setContactError] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const isAdmin = role.trim().toLowerCase() === "admin";

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
      .select(`
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
      `)
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

  async function deleteClient() {
    if (!confirm("Delete this client permanently?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) {
      console.error("Client delete failed:", error);
      return;
    }
    router.push("/dashboard/clients");
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
        0
      ),
      remainingHours: projects.reduce(
        (total, project) => total + Number(project.remaining_hours || 0),
        0
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

  const activeContacts = (client.client_contacts || []).filter(
    (contact) => contact.is_active !== false
  );

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/dashboard/clients")}
          className="mb-6 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Clients
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-slate-500">Client</p>
              {editingClient ? (
                <input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  className="mt-2 rounded-2xl border border-slate-300 px-5 py-3 text-3xl font-bold"
                />
              ) : (
                <h1 className="mt-1 text-4xl font-bold tracking-tight">
                  {client.name}
                </h1>
              )}
              <span className="mt-3 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold capitalize text-green-700">
                {client.status}
              </span>
            </div>

            {isAdmin ? (
              <div className="flex flex-wrap justify-end gap-3">
                {editingClient ? (
                  <>
                    <button
                      type="button"
                      onClick={updateClient}
                      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClient(false);
                        setClientName(client.name);
                      }}
                      className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingClient(true)}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold"
                  >
                    Edit Client
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/dashboard/projects/new?client=${client.id}`)
                  }
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold"
                >
                  + Project
                </button>
                <button
                  type="button"
                  onClick={deleteClient}
                  className="rounded-2xl border border-red-100 px-5 py-3 text-sm font-semibold text-red-600"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["Projects", stats.projectCount],
              ["Team Members", stats.teamCount],
              ["Purchased", stats.purchasedHours],
              ["Remaining", stats.remainingHours],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-50 p-5 text-center">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Contacts</h2>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={openAddContact}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
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
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
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
                    <div className="mt-5 flex gap-2 border-t border-slate-200 pt-4">
                      <button
                        type="button"
                        onClick={() => openEditContact(contact)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deactivateContact(contact)}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600"
                      >
                        Deactivate
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {activeContacts.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                No active contacts yet.
              </p>
            ) : null}
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-semibold">Projects</h2>
            <div className="mt-5 space-y-3">
              {(client.projects || []).map((project) => (
                <div key={project.id} className="rounded-2xl border p-5">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-bold">
                        {project.project_code ? `[${project.project_code}] ` : ""}
                        {project.name}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
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
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                      className="rounded-xl border border-slate-200 px-5"
                    >
                      View
                    </button>
                  </div>
                  <div className="mt-5 grid grid-cols-3 text-center">
                    <div>Purchased<b className="block">{project.purchased_hours}</b></div>
                    <div>Used<b className="block">{project.used_hours}</b></div>
                    <div>Remaining<b className="block">{project.remaining_hours}</b></div>
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
        <div className="relative border-b border-slate-200 px-7 py-6 pr-16">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close contact modal"
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
          <p className="text-sm font-semibold text-[#153E90]">Client contact</p>
          <h2 id="contact-modal-title" className="mt-1 text-2xl font-bold">
            {editing ? "Edit Contact" : "Add Contact"}
          </h2>
        </div>

        <div className="grid gap-5 px-7 py-6 md:grid-cols-2">
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 md:col-span-2">
              {error}
            </p>
          ) : null}

          <ContactInput label="First Name" value={form.firstName} onChange={(value) => update("firstName", value)} />
          <ContactInput label="Last Name" value={form.lastName} onChange={(value) => update("lastName", value)} />
          <div className="md:col-span-2">
            <ContactInput label="Job Title" value={form.jobTitle} onChange={(value) => update("jobTitle", value)} />
          </div>
          <ContactInput label="Email" type="email" required value={form.email} onChange={(value) => update("email", value)} />
          <ContactInput label="Phone" type="tel" value={form.phone} onChange={(value) => update("phone", value)} />

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Contact Type</span>
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
            <span className="text-sm font-semibold text-slate-700">Set as Primary</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-5">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
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
