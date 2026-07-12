"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Contact = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  contact_type: string | null;
  is_active?: boolean;
};

type Client = {
  id: string;
  name: string;
  status: string;
  client_contacts: Contact[];
};

function clientInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function contactBadge(contactType: string | null) {
  switch (contactType?.toLowerCase()) {
    case "billing":
      return "bg-blue-50 text-[#153E90] ring-blue-200";
    case "primary":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "manager":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [addingContactFor, setAddingContactFor] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactType, setContactType] = useState("general");
  const [contactMutationError, setContactMutationError] = useState("");
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactRole, setEditContactRole] = useState("");
  const [editContactType, setEditContactType] = useState("general");

  async function loadClients() {
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
        client_contacts (*)
      `)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    if (data) setClients(data);
  }

  async function addClient() {
    if (!clientName.trim()) return;
    await supabase.from("clients").insert({
      name: clientName.trim(),
      status: "active",
    });
    setClientName("");
    setShowNewClient(false);
    loadClients();
  }

  async function updateClient() {
    if (!editingClient || !editClientName.trim()) return;
    await supabase
      .from("clients")
      .update({ name: editClientName.trim() })
      .eq("id", editingClient);
    setEditingClient(null);
    setEditClientName("");
    loadClients();
  }

  async function deleteClient(id: string) {
    if (!confirm("Delete this client permanently?")) return;
    await supabase.from("clients").delete().eq("id", id);
    loadClients();
  }

  async function addContact(clientId: string) {
    if (!contactName.trim() || !contactEmail.trim()) return;
    setContactMutationError("");
    const normalizedEmail = contactEmail.trim().toLowerCase();
    const contactPayload = {
      p_contact_id: null,
      p_client_id: clientId,
      p_first_name: contactName.trim(),
      p_last_name: null,
      p_job_title: contactRole.trim() || null,
      p_email: normalizedEmail,
      p_phone: null,
      p_contact_type: contactType,
      p_is_primary: contactType === "primary",
    };
    const { error } = await supabase.rpc(
      "save_client_contact",
      contactPayload
    );
    if (error) {
      const { data: inactiveContact, error: lookupError } = await supabase
        .from("client_contacts")
        .select("id")
        .eq("client_id", clientId)
        .ilike("email", normalizedEmail)
        .eq("is_active", false)
        .maybeSingle();

      if (lookupError || !inactiveContact) {
        console.error("Contact add failed:", error);
        setContactMutationError(error.message);
        return;
      }

      if (contactType === "primary") {
        const { error: primaryError } = await supabase
          .from("client_contacts")
          .update({ is_primary: false })
          .eq("client_id", clientId)
          .eq("is_primary", true)
          .eq("is_active", true);

        if (primaryError) {
          setContactMutationError(primaryError.message);
          return;
        }
      }

      const { error: reactivateError } = await supabase
        .from("client_contacts")
        .update({
          first_name: contactName.trim(),
          last_name: null,
          name: contactName.trim(),
          email: normalizedEmail,
          role: contactRole.trim() || null,
          job_title: contactRole.trim() || null,
          contact_type: contactType,
          is_primary: contactType === "primary",
          is_active: true,
        })
        .eq("id", inactiveContact.id)
        .eq("client_id", clientId);

      if (reactivateError) {
        console.error("Contact reactivation failed:", reactivateError);
        setContactMutationError(reactivateError.message);
        return;
      }
    }
    cancelAddContact();
    loadClients();
  }

  async function updateContact() {
    if (!editingContact || !editContactName.trim() || !editContactEmail.trim())
      return;
    const clientId = clients.find((client) =>
      client.client_contacts?.some((contact) => contact.id === editingContact)
    )?.id;
    if (!clientId) return;

    const { error } = await supabase.rpc("save_client_contact", {
      p_contact_id: editingContact,
      p_client_id: clientId,
      p_first_name: editContactName.trim(),
      p_last_name: null,
      p_job_title: editContactRole.trim() || null,
      p_email: editContactEmail.trim(),
      p_phone: null,
      p_contact_type: editContactType,
      p_is_primary: editContactType === "primary",
    });
    if (error) {
      console.error("Contact update failed:", error);
      return;
    }
    setEditingContact(null);
    setEditContactName("");
    setEditContactEmail("");
    setEditContactRole("");
    setEditContactType("general");
    loadClients();
  }

  async function deleteContact(id: string) {
    const { error } = await supabase
      .from("client_contacts")
      .update({ is_active: false, is_primary: false })
      .eq("id", id);
    if (error) {
      console.error("Contact deactivation failed:", error);
      return;
    }
    loadClients();
  }

  function cancelAddContact() {
    setAddingContactFor(null);
    setContactName("");
    setContactEmail("");
    setContactRole("");
    setContactType("general");
    setContactMutationError("");
  }

  useEffect(() => {
    // Existing dashboard page performs its initial Supabase load client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const query = search.toLowerCase().trim();
    const matchingClients = query ? clients.filter((client) => {
      const clientMatch = client.name.toLowerCase().includes(query);
      const contactMatch = client.client_contacts?.some((contact) => {
        if (contact.is_active === false) return false;
        return (
          contact.name.toLowerCase().includes(query) ||
          contact.email.toLowerCase().includes(query) ||
          (contact.role || "").toLowerCase().includes(query) ||
          (contact.contact_type || "").toLowerCase().includes(query)
        );
      });
      return clientMatch || contactMatch;
    }) : clients;

    return [...matchingClients].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [clients, search]);

  const metrics = useMemo(() => {
    const activeContacts = clients.flatMap((client) =>
      (client.client_contacts || []).filter(
        (contact) => contact.is_active !== false
      )
    );
    return {
      totalClients: clients.length,
      activeClients: clients.filter(
        (client) => client.status?.toLowerCase() === "active"
      ).length,
      contacts: activeContacts.length,
      billingContacts: activeContacts.filter(
        (contact) => contact.contact_type?.toLowerCase() === "billing"
      ).length,
    };
  }, [clients]);

  const isAdmin = role.toLowerCase() === "admin";

  return (
    <main className="min-h-screen bg-[#f8fafc] px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-10">
  <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/60 blur-3xl" />
  <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />

  <div className="relative flex items-center justify-between gap-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
        Client portfolio
      </p>

      <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">
        Clients
      </h1>

      <p className="mt-3 text-slate-300">
        Manage client relationships, contacts, and active projects.
      </p>
    </div>

            {isAdmin ? (
              <button
                type="button"
                onClick={() => setShowNewClient(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                <span className="text-lg leading-none text-[#153E90]">+</span>
                New Client
              </button>
            ) : null}
          </div>
        </section>

        <section className="relative z-10 -mt-3 grid grid-cols-2 gap-4 px-3 lg:grid-cols-4 lg:px-6">
          {[
            ["Total Clients", metrics.totalClients, "Portfolio"],
            ["Active", metrics.activeClients, "Engaged"],
            ["Contacts", metrics.contacts, "People"],
            ["Billing Contacts", metrics.billingContacts, "Invoice ready"],
          ].map(([label, value, caption]) => (
            <div
              key={label}
              className="rounded-2xl bg-white p-5 shadow-md shadow-slate-200/60 ring-1 ring-slate-200"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                {label}
              </p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <p className="text-3xl font-bold text-slate-950">{value}</p>
                <p className="pb-1 text-xs font-semibold text-slate-400">
                  {caption}
                </p>
              </div>
            </div>
          ))}
        </section>

        {showNewClient && isAdmin ? (
          <section className="mt-7 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/40">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#153E90]">
                  New relationship
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  Create a client
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add the organization now; contacts and projects can follow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNewClient(false);
                  setClientName("");
                }}
                aria-label="Close new client"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                autoFocus
                placeholder="Company name"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-5 py-3.5 text-slate-950 outline-none transition focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={addClient}
                className="rounded-2xl bg-[#153E90] px-6 py-3.5 font-bold text-white transition hover:bg-[#123578]"
              >
                Create Client
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewClient(false);
                  setClientName("");
                }}
                className="rounded-2xl border border-slate-300 px-6 py-3.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">
              Client portfolio
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredClients.length} {filteredClients.length === 1 ? "client" : "clients"} shown
            </p>
          </div>
          <label className="relative block w-full sm:max-w-md">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-slate-400">
              ⌕
            </span>
            <input
              placeholder="Search clients or contacts..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </section>

        <section className="mt-6 space-y-4">
          {filteredClients.map((client) => {
            const activeContacts = (client.client_contacts || []).filter(
              (contact) => contact.is_active !== false
            );
            return (
              <article
                key={client.id}
                className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/70"
              >
                <div className="border-b border-slate-100 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#153E90] text-lg font-bold text-white shadow-md shadow-blue-200">
                        {clientInitials(client.name)}
                      </div>
                      <div className="min-w-0">
                        {editingClient === client.id ? (
                          <div className="flex flex-wrap gap-2">
                            <input
                              value={editClientName}
                              onChange={(event) => setEditClientName(event.target.value)}
                              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 font-semibold outline-none focus:border-[#153E90]"
                            />
                            <button type="button" onClick={updateClient} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">Save</button>
                            <button type="button" onClick={() => { setEditingClient(null); setEditClientName(""); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Cancel</button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                              className="block max-w-full truncate text-left text-xl font-bold text-slate-950 transition hover:text-[#153E90]"
                            >
                              {client.name}
                            </button>
                            <p className="mt-1 text-sm text-slate-500">
                              {activeContacts.length} active {activeContacts.length === 1 ? "contact" : "contacts"}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold capitalize text-emerald-700 ring-1 ring-emerald-200">
                      {client.status}
                    </span>
                  </div>

                  {isAdmin && editingClient !== client.id ? (
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                      <button type="button" onClick={() => router.push(`/dashboard/clients/${client.id}`)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">View Client</button>
                      <button type="button" onClick={() => { setEditingClient(client.id); setEditClientName(client.name); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                      <button type="button" onClick={() => { setContactMutationError(""); setAddingContactFor(addingContactFor === client.id ? null : client.id); }} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-[#153E90] hover:bg-blue-50">+ Contact</button>
                      <button type="button" onClick={() => deleteClient(client.id)} className="ml-auto rounded-xl border border-red-100 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">Delete</button>
                    </div>
                  ) : null}
                </div>

                {addingContactFor === client.id && isAdmin ? (
                  <div className="border-b border-blue-100 bg-blue-50/50 p-5">
                    <p className="text-sm font-bold text-[#153E90]">Add a contact</p>
                    {contactMutationError ? (
                      <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {contactMutationError}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input placeholder="Name" value={contactName} onChange={(event) => setContactName(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-[#153E90]" />
                      <input placeholder="Email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-[#153E90]" />
                      <input placeholder="Role" value={contactRole} onChange={(event) => setContactRole(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-[#153E90]" />
                      <select value={contactType} onChange={(event) => setContactType(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-[#153E90]">
                        <option value="general">General</option><option value="primary">Primary</option><option value="billing">Billing</option><option value="manager">Manager</option>
                      </select>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => addContact(client.id)} className="rounded-xl bg-[#153E90] px-4 py-2.5 text-sm font-bold text-white">Save Contact</button>
                      <button type="button" onClick={cancelAddContact} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                    </div>
                  </div>
                ) : null}

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Key contacts</p>
                    <p className="text-xs font-semibold text-slate-400">{activeContacts.length} total</p>
                  </div>
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {activeContacts.map((contact) => (
                      <div key={contact.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        {editingContact === contact.id && isAdmin ? (
                          <div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <input value={editContactName} onChange={(event) => setEditContactName(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[#153E90]" />
                              <input value={editContactEmail} onChange={(event) => setEditContactEmail(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[#153E90]" />
                              <input value={editContactRole} onChange={(event) => setEditContactRole(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[#153E90]" />
                              <select value={editContactType} onChange={(event) => setEditContactType(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[#153E90]"><option value="general">General</option><option value="primary">Primary</option><option value="billing">Billing</option><option value="manager">Manager</option></select>
                            </div>
                            <div className="mt-3 flex gap-2"><button type="button" onClick={updateContact} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Save</button><button type="button" onClick={() => { setEditingContact(null); setEditContactName(""); setEditContactEmail(""); setEditContactRole(""); setEditContactType("general"); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Cancel</button></div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-bold text-slate-900">{contact.name}</p>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ${contactBadge(contact.contact_type)}`}>{contact.contact_type || "general"}</span>
                              </div>
                              <p className="mt-1 truncate text-sm text-slate-500">{contact.email}</p>
                              {contact.role ? <p className="mt-0.5 text-xs text-slate-400">{contact.role}</p> : null}
                            </div>
                            {isAdmin ? (
                              <div className="flex shrink-0 gap-2">
                                <button type="button" onClick={() => { setEditingContact(contact.id); setEditContactName(contact.name); setEditContactEmail(contact.email); setEditContactRole(contact.role || ""); setEditContactType(contact.contact_type || "general"); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Edit</button>
                                <button type="button" onClick={() => deleteContact(contact.id)} className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Deactivate</button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                    {activeContacts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center">
                        <p className="font-semibold text-slate-600">No contacts yet</p>
                        <p className="mt-1 text-sm text-slate-400">Add a primary or billing contact to complete this relationship.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {filteredClients.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#153E90]">⌕</div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">No clients found</h3>
            <p className="mt-2 text-sm text-slate-500">Try a different client, contact, role, or email.</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
