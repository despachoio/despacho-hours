"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";


type Invoice = {
  id: string;
  invoice_number: number;
  issue_date: string;
  due_date: string;
  currency: string;
  total_amount: number;
  status: string;
  generated_from_recurring: boolean;

  clients: {
    name: string;
  } | null;
};



export default function InvoicesPage(){


const router =
useRouter();


const [invoices,setInvoices] =
useState<Invoice[]>([]);





async function loadInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      issue_date,
      due_date,
      currency,
      total_amount,
      status,
      generated_from_recurring,
      clients(
        name
      )
    `)
    .order("invoice_number", {
      ascending: false,
    });

  if (error) {
    console.error("Invoice load error:", error);
    alert(error.message);
    return;
  }

  setInvoices((data || []) as unknown as Invoice[]);
}





useEffect(()=>{

loadInvoices();

},[]);






function formatDate(date:string){

return new Date(date)

.toLocaleDateString(

"en-GB",

{
day:"2-digit",
month:"short",
year:"numeric",
}

)

.replace(/ /g,"-");

}

function getDueStatus(dueDate:string, status:string){

  if(status==="paid"){

    return {
      text:"Paid",
      className:"bg-green-100 text-green-700",
    };

  }


  const today=new Date();

  today.setHours(0,0,0,0);


  const due=new Date(dueDate);

  due.setHours(0,0,0,0);


  const days=Math.round(

    (due.getTime()-today.getTime())

    /

    (1000*60*60*24)

  );


  if(days>0){

    return {
      text:`Due in ${days} days`,
      className:"bg-blue-100 text-blue-700",
    };

  }


  if(days===0){

    return {
      text:"Due today",
      className:"bg-yellow-100 text-yellow-700",
    };

  }


  return {

    text:`${Math.abs(days)} days late`,

    className:"bg-red-100 text-red-700",

  };

}




return(

<main className="min-h-screen bg-[#f8fafc] px-8 py-7">


<div className="mx-auto max-w-7xl">



<div className="flex items-center justify-between">


<div>


<h1 className="text-4xl font-bold">

Invoices

</h1>


<p className="mt-2 text-slate-500">

Manage client invoices and payments.

</p>


</div>





<button

onClick={()=>

router.push(

"/dashboard/invoices/new"

)

}

className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"

>

+ New Invoice

</button>



</div>






<div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white">


<table className="w-full table-fixed">


<thead className="border-b border-slate-200 bg-slate-50">


<tr>

<th className="w-[15%] px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">

Invoice #

</th>


<th className="w-[20%] px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">

Client

</th>


<th className="w-[20%] px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">

Invoice Date

</th>


<th className="w-[15%] px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">

Amount

</th>


<th className="w-[15%] px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">

Status

</th>


<th className="w-[15%] px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">

  Payment Due

</th>


</tr>


</thead>





<tbody>


{invoices.length ? (

invoices.map(invoice=>(


<tr

key={invoice.id}

onClick={() =>
  router.push(`/dashboard/invoices/${invoice.id}`)
}

className="group cursor-pointer border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50"

>


<td className="p-4 pl-6">
  <span className="font-bold text-slate-900 transition-colors group-hover:text-blue-600">
    #{invoice.invoice_number}
  </span>
  {invoice.generated_from_recurring ? <span className="ml-2 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase text-violet-700">Recurring</span> : null}
</td>



<td className="p-4">

{invoice.clients?.name}

</td>



<td className="p-4 text-center">

  {formatDate(invoice.issue_date)}

</td>




<td className="p-4 text-center font-bold">

{invoice.currency}
{" "}
{Number(invoice.total_amount || 0).toFixed(2)}

</td>





<td className="p-4 text-center">


<span

className={`rounded-full px-3 py-1 text-xs font-semibold

${

invoice.status==="paid"

?"bg-green-100 text-green-700"

:invoice.status==="sent"

?"bg-yellow-100 text-yellow-700"

:"bg-slate-100 text-slate-700"

}

`}

>

{invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}

</span>


</td>




<td className="p-4 text-center">
  {(() => {
    const dueStatus = getDueStatus(
      invoice.due_date,
      invoice.status
    );

    return (
      <div className="flex flex-col items-center gap-1">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${dueStatus.className}`}
        >
          {dueStatus.text}
        </span>

      </div>
    );
  })()}
</td>


</tr>


))

):(


<tr>


<td

colSpan={6}

className="p-10 text-center text-slate-500"

>

No invoices created yet.

</td>


</tr>


)}


</tbody>


</table>


</div>


</div>


</main>

);


}
