"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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
      .order("created_at", { ascending: false });

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

    await supabase.from("client_contacts").insert({
      client_id: clientId,
      name: contactName.trim(),
      email: contactEmail.trim(),
      role: contactRole.trim() || null,
      contact_type: contactType,
    });

    cancelAddContact();
    loadClients();
  }

  async function updateContact() {
    if (!editingContact || !editContactName.trim() || !editContactEmail.trim())
      return;

    await supabase
      .from("client_contacts")
      .update({
        name: editContactName.trim(),
        email: editContactEmail.trim(),
        role: editContactRole.trim() || null,
        contact_type: editContactType,
      })
      .eq("id", editingContact);

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
  }

  useEffect(() => {
    // Existing dashboard page performs its initial Supabase load client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return clients;

    return clients.filter((client) => {
      const clientMatch = client.name.toLowerCase().includes(q);

      const contactMatch = client.client_contacts?.some((contact) => {
        if (contact.is_active === false) return false;
        return (
          contact.name.toLowerCase().includes(q) ||
          contact.email.toLowerCase().includes(q) ||
          (contact.role || "").toLowerCase().includes(q) ||
          (contact.contact_type || "").toLowerCase().includes(q)
        );
      });

      return clientMatch || contactMatch;
    });
  }, [clients, search]);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950">
              Clients
            </h1>

            <p className="mt-2 text-slate-500">
              Manage companies, contacts and relationships.
            </p>
          </div>

          {role === "Admin" && (
            <button
              onClick={() => setShowNewClient(true)}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm"
            >
              + New Client
            </button>
          )}
        </div>

        {showNewClient && role === "Admin" && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">
              Create client
            </h2>

            <div className="mt-5 flex gap-3">
              <input
                placeholder="Company name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 outline-none focus:border-slate-950"
              />

              <button
                onClick={addClient}
                className="rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white"
              >
                Save
              </button>

              <button
                onClick={() => {
                  setShowNewClient(false);
                  setClientName("");
                }}
                className="rounded-2xl border border-slate-200 px-6 py-3 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <input
          placeholder="Search clients or contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm outline-none focus:border-slate-950"
        />

        <div className="mt-8 space-y-5">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  {editingClient === client.id ? (
                    <div className="flex gap-3">
                      <input
                        value={editClientName}
                        onChange={(e) => setEditClientName(e.target.value)}
                        className="rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-slate-950"
                      />

                      <button
                        onClick={updateClient}
                        className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Save
                      </button>

                      <button
                        onClick={() => {
                          setEditingClient(null);
                          setEditClientName("");
                        }}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          router.push(`/dashboard/clients/${client.id}`)
                        }
                        className="text-left text-xl font-semibold text-slate-950 hover:underline"
                      >
                        {client.name}
                      </button>

                      <p className="text-sm text-slate-500">
                        {client.client_contacts?.filter(
                          (contact) => contact.is_active !== false
                        ).length || 0} contacts
                      </p>
                    </>
                  )}
                </div>

                {role === "Admin" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEditingClient(client.id);
                        setEditClientName(client.name);
                      }}
                      className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        setAddingContactFor(
                          addingContactFor === client.id ? null : client.id
                        )
                      }
                      className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      + Add Contact
                    </button>

                    <button
                      onClick={() => deleteClient(client.id)}
                      className="rounded-2xl border border-red-100 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {addingContactFor === client.id && role === "Admin" && (
                <div className="grid grid-cols-6 gap-3 border-b border-slate-200 p-5">
                  <input
                    placeholder="Name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
                  />

                  <input
                    placeholder="Email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
                  />

                  <input
                    placeholder="Role"
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                    className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
                  />

                  <select
                    value={contactType}
                    onChange={(e) => setContactType(e.target.value)}
                    className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
                  >
                    <option value="general">General</option>
                    <option value="primary">Primary</option>
                    <option value="billing">Billing</option>
                    <option value="manager">Manager</option>
                  </select>

                  <button
                    onClick={() => addContact(client.id)}
                    className="rounded-xl bg-slate-950 font-semibold text-white hover:bg-slate-800"
                  >
                    Save
                  </button>

                  <button
                    onClick={cancelAddContact}
                    className="rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {client.client_contacts?.some(
                (contact) => contact.is_active !== false
              ) ? (
                client.client_contacts
                  .filter((contact) => contact.is_active !== false)
                  .map((contact) => (
                  <div
                    key={contact.id}
                    className="border-b border-slate-200 px-6 py-4 last:border-0"
                  >
                    {editingContact === contact.id && role === "Admin" ? (
                      <div>
                        <div className="grid grid-cols-4 gap-3">
                          <input
                            value={editContactName}
                            onChange={(e) =>
                              setEditContactName(e.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
                          />

                          <input
                            value={editContactEmail}
                            onChange={(e) =>
                              setEditContactEmail(e.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
                          />

                          <input
                            value={editContactRole}
                            onChange={(e) =>
                              setEditContactRole(e.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
                          />

                          <select
                            value={editContactType}
                            onChange={(e) =>
                              setEditContactType(e.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
                          >
                            <option value="general">General</option>
                            <option value="primary">Primary</option>
                            <option value="billing">Billing</option>
                            <option value="manager">Manager</option>
                          </select>
                        </div>

                        <div className="mt-3 flex gap-3">
                          <button
                            onClick={updateContact}
                            className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800"
                          >
                            Save
                          </button>

                          <button
                            onClick={() => {
                              setEditingContact(null);
                              setEditContactName("");
                              setEditContactEmail("");
                              setEditContactRole("");
                              setEditContactType("general");
                            }}
                            className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            {contact.name}
                          </p>

                          <p className="text-sm text-slate-500">
                            {contact.email}
                          </p>

                          
                        </div>

                        {role === "Admin" && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setEditingContact(contact.id);
                                setEditContactName(contact.name);
                                setEditContactEmail(contact.email);
                                setEditContactRole(contact.role || "");
                                setEditContactType(
                                  contact.contact_type || "general"
                                );
                              }}
                              className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => deleteContact(contact.id)}
                              className="rounded-2xl border border-red-100 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                            >
                              Deactivate
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-6 py-6 text-sm text-slate-500">
                  No contacts added yet.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
