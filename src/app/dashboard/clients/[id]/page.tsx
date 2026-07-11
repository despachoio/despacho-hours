"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

type Contact = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  contact_type: string | null;
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

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();

  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);

  const [editingClient, setEditingClient] = useState(false);
  const [clientName, setClientName] = useState("");

  const [showAddContact, setShowAddContact] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactType, setContactType] = useState("general");
  const [role, setRole] = useState("");

  async function loadClient() {
    const { data: userData } = await supabase.auth.getUser();


if (userData.user) {

  const { data: profile } = await supabase

    .from("profiles")

    .select("role")

    .eq(
      "user_id",
      userData.user.id
    )

    .single();


  setRole(
    profile?.role || ""
  );

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
          project_resources (
            id,
            employee_id
          )
        )
      `)
      .eq("id", clientId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setClient(data as Client);
      setClientName(data.name);
    }
  }

  async function updateClient() {
    if (!clientName.trim()) return;

    await supabase
      .from("clients")
      .update({
        name: clientName.trim(),
      })
      .eq("id", clientId);

    setEditingClient(false);
    loadClient();
  }

  async function addContact() {
    if (!contactName.trim() || !contactEmail.trim()) return;

    await supabase.from("client_contacts").insert({
      client_id: clientId,
      name: contactName.trim(),
      email: contactEmail.trim(),
      role: contactRole.trim() || null,
      contact_type: contactType,
    });

    setContactName("");
    setContactEmail("");
    setContactRole("");
    setContactType("general");
    setShowAddContact(false);

    loadClient();
  }

  async function deleteContact(id: string) {
    if (!confirm("Remove this contact?")) return;

    await supabase
      .from("client_contacts")
      .delete()
      .eq("id", id);

    loadClient();
  }

  async function deleteClient() {
    if (!confirm("Delete this client permanently?")) return;

    await supabase
      .from("clients")
      .delete()
      .eq("id", clientId);

    router.push("/dashboard/clients");
  }

  const stats = useMemo(() => {
    if (!client) {
      return {
        projectCount: 0,
        teamCount: 0,
        purchasedHours: 0,
        remainingHours: 0,
      };
    }

    const projectCount = client.projects?.length || 0;

    const purchasedHours =
      client.projects?.reduce(
        (total, project) => total + Number(project.purchased_hours || 0),
        0
      ) || 0;

    const remainingHours =
      client.projects?.reduce(
        (total, project) => total + Number(project.remaining_hours || 0),
        0
      ) || 0;

    const teamIds = new Set<string>();

    client.projects?.forEach((project) => {
      project.project_resources?.forEach((resource) => {
        if (resource.employee_id) {
          teamIds.add(resource.employee_id);
        }
      });
    });

    return {
      projectCount,
      teamCount: teamIds.size,
      purchasedHours,
      remainingHours,
    };
  }, [client]);

  useEffect(() => {
    loadClient();
  }, []);

  if (!client) return null;
    return (

    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">


      <div className="mx-auto max-w-6xl">


        <button

          onClick={() =>
            router.push("/dashboard/clients")
          }

          className="mb-6 text-sm font-medium text-slate-500"

        >

          ← Back to Clients

        </button>






        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">


          <div className="flex items-start justify-between">


            <div>


              <p className="text-sm font-medium text-slate-500">

                Client

              </p>



              {editingClient ? (

                <input

                  value={clientName}

                  onChange={(e)=>
                    setClientName(
                      e.target.value
                    )
                  }

                  className="mt-2 rounded-2xl border px-5 py-3 text-3xl font-bold"

                />

              ) : (

                <h1 className="mt-1 text-4xl font-bold tracking-tight">

                  {client.name}

                </h1>

              )}






              <span className="mt-3 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">

                {client.status}

              </span>


            </div>







            {role === "Admin" && (

  <div className="flex gap-3">


    {editingClient ? (

      <>


        <button

          onClick={updateClient}

          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"

        >

          Save

        </button>




        <button

          onClick={() => {

            setEditingClient(false);

            setClientName(client.name);

          }}

          className="rounded-2xl border px-5 py-3 text-sm font-semibold"

        >

          Cancel

        </button>


      </>


    ) : (


      <button

        onClick={() =>
          setEditingClient(true)
        }

        className="rounded-2xl border px-5 py-3 text-sm font-semibold"

      >

        Edit Client

      </button>


    )}






    <button

      onClick={() =>
        setShowAddContact(true)
      }

      className="rounded-2xl border px-5 py-3 text-sm font-semibold"

    >

      + Contact

    </button>







    <button

      onClick={() =>

        router.push(

          `/dashboard/projects/new?client=${client.id}`

        )

      }

      className="rounded-2xl border px-5 py-3 text-sm font-semibold"

    >

      + Project

    </button>







    <button

      onClick={deleteClient}

      className="rounded-2xl border border-red-100 px-5 py-3 text-sm font-semibold text-red-600"

    >

      Delete

    </button>



  </div>

)}


          </div>









          <div className="mt-10 grid grid-cols-4 gap-4">

  {[

    ["Projects", stats.projectCount],

    ["Team Members", stats.teamCount],

    ["Purchased", stats.purchasedHours],

    ["Remaining", stats.remainingHours],

  ].map(([label,value])=>(

    <div

      key={label}

      className="rounded-2xl bg-slate-50 p-5 text-center"

    >

      <p className="text-sm font-semibold text-slate-500">

        {label}

      </p>

      <p className="mt-2 text-2xl font-bold text-slate-950">

        {value}

      </p>

    </div>

  ))}

</div>











          {showAddContact && (


            <div className="mt-10 rounded-3xl bg-slate-50 p-5">


              <h2 className="text-lg font-semibold">

                Add Contact

              </h2>



              <div className="mt-5 grid grid-cols-4 gap-3">


                <input

                  placeholder="Name"

                  value={contactName}

                  onChange={(e)=>
                    setContactName(e.target.value)
                  }

                  className="rounded-2xl border px-5 py-3"

                />




                <input

                  placeholder="Email"

                  value={contactEmail}

                  onChange={(e)=>
                    setContactEmail(e.target.value)
                  }

                  className="rounded-2xl border px-5 py-3"

                />




                <input

                  placeholder="Role"

                  value={contactRole}

                  onChange={(e)=>
                    setContactRole(e.target.value)
                  }

                  className="rounded-2xl border px-5 py-3"

                />





                <select

                  value={contactType}

                  onChange={(e)=>
                    setContactType(e.target.value)
                  }

                  className="rounded-2xl border px-5 py-3"

                >


                  <option value="general">
                    General
                  </option>

                  <option value="primary">
                    Primary
                  </option>

                  <option value="billing">
                    Billing
                  </option>


                </select>


              </div>






              <div className="mt-4 flex gap-3">


                <button

                  onClick={addContact}

                  className="rounded-2xl bg-slate-950 px-6 py-3 text-white"

                >

                  Save

                </button>



                <button

                  onClick={()=>
                    setShowAddContact(false)
                  }

                  className="rounded-2xl border px-6"

                >

                  Cancel

                </button>


              </div>


            </div>


          )}












          <div className="mt-10">


            <h2 className="text-xl font-semibold">

              Contacts

            </h2>




            <div className="mt-5 space-y-3">


              {client.client_contacts.map(contact=>(


                <div
  key={contact.id}
  className="flex items-center justify-between rounded-2xl bg-slate-50 p-5"
>


  <div>


    <p className="text-lg font-bold text-slate-950">

      {contact.name}

    </p>


    {contact.role && (

      <p className="text-sm text-slate-500">

        {contact.role}

      </p>

    )}


    <p className="mt-3 text-sm text-slate-600">

      Email:{" "}

      <span className="font-semibold text-slate-950">

        {contact.email}

      </span>

    </p>


    <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">

      {contact.contact_type}

    </span>


  </div>



  <button

    onClick={()=>
      deleteContact(
        contact.id
      )
    }

    className="rounded-xl border border-red-100 px-4 py-2 text-sm font-semibold text-red-600"

  >

    Remove

  </button>


</div>


              ))}


            </div>


          </div>









          <div className="mt-10">


            <h2 className="text-xl font-semibold">

              Projects

            </h2>






            <div className="mt-5 space-y-3">


              {client.projects.map(project=>(


                <div

                  key={project.id}

                  className="rounded-2xl border p-5"

                >


                  <div className="flex justify-between">


                    <div>


                      <p className="font-bold">

                        [{project.project_code}] {project.name}

                      </p>



                      <span

  className={`

    mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold

    ${

      project.status === "active"

      ? "bg-green-100 text-green-700"

      : project.status === "archived"

      ? "bg-red-100 text-red-700"

      : "bg-yellow-100 text-yellow-700"

    }

  `}

>

  {project.status}

</span>


                    </div>






                    <button

  onClick={()=>

    router.push(

      `/dashboard/projects/${project.id}`

    )

  }

  className="rounded-xl border px-5"

>

  View

</button>


                  </div>








                  <div className="mt-5 grid grid-cols-3 text-center">


                    <div>

                      Purchased

                      <b className="block">

                        {project.purchased_hours}

                      </b>

                    </div>



                    <div>

                      Used

                      <b className="block">

                        {project.used_hours}

                      </b>

                    </div>




                    <div>

                      Remaining

                      <b className="block">

                        {project.remaining_hours}

                      </b>

                    </div>


                  </div>


                </div>


              ))}


            </div>


          </div>





        </div>


      </div>


    </main>

  );

}