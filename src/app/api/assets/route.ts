import { NextResponse } from "next/server";
import { getProfileApiContext } from "@/lib/server/profile-auth";
import { canAdministerAssets, canEmployeeCancelAssetRequest, isAssetAvailable, nonNegativeQuantity, requestCode } from "@/lib/assets/workflow";
import { notifyAssetRequest } from "@/lib/assets/notifications";

const requestSelect="*,employee:employees!asset_requests_employee_id_fkey(id,employee_code,name,title),category:asset_categories!asset_requests_category_id_fkey(name),item:asset_items!asset_requests_item_id_fkey(name,item_type,stock_tracked,individually_tracked,current_stock),request_type:asset_request_types!asset_requests_request_type_id_fkey(name,code),existing_asset:assets!asset_requests_existing_asset_id_fkey(asset_tag,brand,model)";
const assignmentSelect="*,employee:employees!asset_assignments_employee_id_fkey(id,employee_code,name,title),asset:assets!asset_assignments_asset_id_fkey(*,item:asset_items!assets_item_id_fkey(*))";
const assetSelect="*,item:asset_items!inner(*)";
function errorMessage(cause:unknown){
  if(cause instanceof Error)return cause.message;
  if(cause&&typeof cause==="object"&&"message" in cause&&typeof cause.message==="string")return cause.message;
  return "Asset operation failed";
}
function jsonError(cause:unknown,status=400){return NextResponse.json({error:errorMessage(cause)},{status});}

export async function GET(request:Request){
  const context=await getProfileApiContext(request);if("error" in context)return NextResponse.json({error:context.error},{status:context.status});
  const canAdminister=canAdministerAssets(context.profile.role);const employeeId=context.profile.employee_id;const params=new URL(request.url).searchParams;const view=params.get("view")||"bootstrap";
  const [categories,types,items,employees]=await Promise.all([
    context.admin.from("asset_categories").select("*").order("display_order"),
    context.admin.from("asset_request_types").select("*").order("display_order"),
    context.admin.from("asset_items").select("*,category:asset_categories!asset_items_category_id_fkey(name)").order("display_order"),
    canAdminister?context.admin.from("employees").select("id,employee_code,name,title").eq("status","active").order("employee_code"):Promise.resolve({data:[],error:null}),
  ]);
  const failure=[categories,types,items,employees].find((result)=>result.error);
  if(failure?.error)return jsonError(failure.error,500);
  const categoryOrder=new Map((categories.data||[]).map((category,index)=>[category.id,index]));
  const catalogueItems=[...(items.data||[])].sort((left,right)=>(categoryOrder.get(left.category_id)??Number.MAX_SAFE_INTEGER)-(categoryOrder.get(right.category_id)??Number.MAX_SAFE_INTEGER)||left.display_order-right.display_order||left.name.localeCompare(right.name));
  const payload={role:context.profile.role,employeeId,canAdminister,categories:categories.data||[],requestTypes:types.data||[],items:catalogueItems,assets:[],assignments:[],requests:[],employees:employees.data||[],history:[],audit:[]};

  if(!canAdminister){
    const [assignments,requests]=await Promise.all([
      context.admin.from("asset_assignments").select(assignmentSelect).eq("employee_id",employeeId).order("created_at",{ascending:false}),
      context.admin.from("asset_requests").select(requestSelect).eq("employee_id",employeeId).order("created_at",{ascending:false}),
    ]);if(assignments.error||requests.error)return jsonError(assignments.error||requests.error,500);
    return NextResponse.json({...payload,assignments:assignments.data||[],requests:requests.data||[]});
  }

  if(view==="my_assets"){
    const assignments=await context.admin.from("asset_assignments").select(assignmentSelect).eq("employee_id",employeeId).order("created_at",{ascending:false});
    if(assignments.error)return jsonError(assignments.error,500);
    return NextResponse.json({...payload,assignments:assignments.data||[]});
  }

  if(view==="available"){
    const [available,activeAssignments]=await Promise.all([
      context.admin.from("assets").select(assetSelect).in("status",["available","returned"]).order("asset_tag"),
      context.admin.from("asset_assignments").select("asset_id").eq("status","assigned"),
    ]);if(available.error||activeAssignments.error)return jsonError(available.error||activeAssignments.error,500);
    const assignedIds=new Set((activeAssignments.data||[]).map((row)=>row.asset_id));
    return NextResponse.json({...payload,assets:(available.data||[]).filter((asset)=>isAssetAvailable(asset,assignedIds,asset.id))});
  }

  if(view==="assignments"){
    if(params.get("searched")!=="true")return NextResponse.json(payload);
    let query=context.admin.from("asset_assignments").select(assignmentSelect,{count:"exact"}).order("created_at",{ascending:false});
    const selectedEmployee=params.get("employeeId"),selectedItem=params.get("itemId"),selectedStatus=params.get("status");
    if(selectedEmployee)query=query.eq("employee_id",selectedEmployee);if(selectedStatus)query=query.eq("status",selectedStatus);
    if(selectedItem){const matchingAssets=await context.admin.from("assets").select("id").eq("item_id",selectedItem);if(matchingAssets.error)return jsonError(matchingAssets.error,500);const assetIds=(matchingAssets.data||[]).map((row)=>row.id);if(!assetIds.length)return NextResponse.json({...payload,total:0});query=query.in("asset_id",assetIds);}
    const result=await query.range(0,199);if(result.error)return jsonError(result.error,500);return NextResponse.json({...payload,assignments:result.data||[],total:result.count||0});
  }

  if(view==="requests"){
    if(params.get("searched")!=="true")return NextResponse.json(payload);
    let query=context.admin.from("asset_requests").select(requestSelect,{count:"exact"}).order("created_at",{ascending:false});
    const employee=params.get("employeeId"),category=params.get("categoryId"),item=params.get("itemId"),requestType=params.get("requestTypeId"),status=params.get("status"),from=params.get("requestedFrom"),to=params.get("requestedTo"),search=params.get("search")?.trim();
    if(employee)query=query.eq("employee_id",employee);if(category)query=query.eq("category_id",category);if(item)query=query.eq("item_id",item);if(requestType)query=query.eq("request_type_id",requestType);if(status)query=query.eq("status",status);if(from)query=query.gte("created_at",`${from}T00:00:00`);if(to)query=query.lte("created_at",`${to}T23:59:59`);if(search)query=query.ilike("request_code",`%${search}%`);
    const [result,available,activeAssignments]=await Promise.all([query.range(0,199),context.admin.from("assets").select(assetSelect).in("status",["available","returned"]).order("asset_tag"),context.admin.from("asset_assignments").select("asset_id").eq("status","assigned")]);if(result.error||available.error||activeAssignments.error)return jsonError(result.error||available.error||activeAssignments.error,500);const assignedIds=new Set((activeAssignments.data||[]).map((row)=>row.asset_id));return NextResponse.json({...payload,requests:result.data||[],assets:(available.data||[]).filter((asset)=>isAssetAvailable(asset,assignedIds,asset.id)),total:result.count||0});
  }

  if(view==="inventory"){
    let assetQuery=context.admin.from("assets").select(assetSelect).order("created_at",{ascending:false});const status=params.get("status"),search=params.get("search")?.trim();
    if(status==="active")assetQuery=assetQuery.eq("active",true);else if(status==="inactive")assetQuery=assetQuery.eq("active",false);if(search)assetQuery=assetQuery.or(`asset_tag.ilike.%${search}%,serial_number.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`);
    const assets=await assetQuery.range(0,499);if(assets.error)return jsonError(assets.error,500);return NextResponse.json({...payload,assets:assets.data||[]});
  }

  if(view==="dashboard"){
    const [assignments,requests,assets]=await Promise.all([context.admin.from("asset_assignments").select(assignmentSelect).order("created_at",{ascending:false}).limit(500),context.admin.from("asset_requests").select(requestSelect).order("created_at",{ascending:false}).limit(100),context.admin.from("assets").select(assetSelect).order("created_at",{ascending:false}).limit(500)]);if(assignments.error||requests.error||assets.error)return jsonError(assignments.error||requests.error||assets.error,500);return NextResponse.json({...payload,assignments:assignments.data||[],requests:requests.data||[],assets:assets.data||[]});
  }
  return NextResponse.json(payload);
}

export async function POST(request:Request){
  const context=await getProfileApiContext(request);if("error" in context)return NextResponse.json({error:context.error},{status:context.status});
  try{
    const body=await request.json() as Record<string,unknown>;const action=String(body.action||"");const adminAllowed=canAdministerAssets(context.profile.role);
    const audit=async(values:{action:string;entityType:string;entityId?:string;employeeId?:string;requestId?:string;oldValue?:unknown;newValue?:unknown;notes?:string})=>{
      const result=await context.admin.from("asset_audit_log").insert({entity_type:values.entityType,entity_id:values.entityId||null,employee_id:values.employeeId||null,request_id:values.requestId||null,action:values.action,old_value:values.oldValue||null,new_value:values.newValue||null,actor_user_id:context.user.id,actor_role:String(context.profile.role||""),notes:values.notes||null});if(result.error)throw result.error;
    };
    const history=async(requestId:string,event:string,oldStatus:string|null,newStatus:string|null,comment?:string,metadata?:unknown)=>{const result=await context.admin.from("asset_request_history").insert({request_id:requestId,action:event,old_status:oldStatus,new_status:newStatus,actor_user_id:context.user.id,comment:comment||null,metadata:metadata||{}});if(result.error)throw result.error;};

    if(action==="create_request"){
      const categoryId=String(body.categoryId||""),itemId=String(body.itemId||""),requestTypeId=String(body.requestTypeId||"");
      const [item,type]=await Promise.all([context.admin.from("asset_items").select("id,category_id,active").eq("id",itemId).single(),context.admin.from("asset_request_types").select("id,active").eq("id",requestTypeId).single()]);
      if(item.error||type.error||!item.data.active||!type.data.active||item.data.category_id!==categoryId)throw new Error("Select a valid category, item, and request type");
      const reason=String(body.reason||"").trim();if(!reason)throw new Error("Reason is required");
      const existingAssetId=body.existingAssetId?String(body.existingAssetId):null;
      if(existingAssetId){const owned=await context.admin.from("asset_assignments").select("id").eq("employee_id",context.profile.employee_id).eq("asset_id",existingAssetId).eq("status","assigned").maybeSingle();if(!owned.data)throw new Error("The linked asset is not currently assigned to you");}
      const code=requestCode(Date.now()%1000000);const result=await context.admin.from("asset_requests").insert({request_code:code,employee_id:context.profile.employee_id,category_id:categoryId,item_id:itemId,request_type_id:requestTypeId,quantity_requested:nonNegativeQuantity(body.quantity),reason,comments:String(body.comments||"").trim()||null,existing_asset_id:existingAssetId,created_by:context.user.id}).select("id").single();if(result.error)throw result.error;
      await history(result.data.id,"request_created",null,"pending_approval");await audit({action:"request_created",entityType:"request",entityId:result.data.id,employeeId:context.profile.employee_id,requestId:result.data.id,newValue:{requestCode:code}});
      await notifyAssetRequest(context.admin,{type:"created",requestId:result.data.id}).catch(console.error);
      return NextResponse.json({ok:true,id:result.data.id});
    }
    if(action==="cancel_request"){
      const id=String(body.id||"");const current=await context.admin.from("asset_requests").select("id,employee_id,status").eq("id",id).single();if(current.error)throw current.error;
      if(current.data.employee_id!==context.profile.employee_id||!canEmployeeCancelAssetRequest(current.data.status))throw new Error("Only your pending request can be cancelled");
      const update=await context.admin.from("asset_requests").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",id);if(update.error)throw update.error;
      await history(id,"request_cancelled",current.data.status,"cancelled");await audit({action:"request_cancelled",entityType:"request",entityId:id,employeeId:current.data.employee_id,requestId:id});return NextResponse.json({ok:true});
    }
    if(!adminAllowed)return jsonError(new Error("Asset administrator access required"),403);

    if(action==="create_asset"){
      const itemId=String(body.itemId||""),assetTag=String(body.assetTag||"").trim();if(!itemId||!assetTag)throw new Error("Item and asset tag are required");const item=await context.admin.from("asset_items").select("id,active,item_type,individually_tracked").eq("id",itemId).single();if(item.error||!item.data.active)throw new Error("Select an active catalogue item");if(item.data.item_type!=="durable_asset"&&!item.data.individually_tracked)throw new Error("Physical assets can only be added for individually tracked items");
      const values={item_id:itemId,brand:String(body.brand||"").trim()||null,model:String(body.model||"").trim()||null,serial_number:String(body.serialNumber||"").trim()||null,asset_tag:assetTag,purchased_at:body.purchasedAt||null,warranty_expiry:body.warrantyExpiry||null,condition:String(body.condition||"good"),status:String(body.status||"available"),active:body.active!==false,notes:String(body.notes||"").trim()||null,created_by:context.user.id,updated_by:context.user.id};const result=await context.admin.from("assets").insert(values).select("id").single();if(result.error)throw result.error;await audit({action:"ASSET_CREATED",entityType:"asset",entityId:result.data.id,newValue:values});return NextResponse.json({ok:true,id:result.data.id});
    }
    if(action==="update_asset"){
      const id=String(body.id||"");const current=await context.admin.from("assets").select("*").eq("id",id).single();if(current.error)throw current.error;const values={brand:String(body.brand||"").trim()||null,model:String(body.model||"").trim()||null,serial_number:String(body.serialNumber||"").trim()||null,asset_tag:String(body.assetTag||"").trim(),purchased_at:body.purchasedAt||null,warranty_expiry:body.warrantyExpiry||null,condition:String(body.condition||current.data.condition),status:String(body.status||current.data.status),active:body.active!==false,notes:String(body.notes||"").trim()||null,updated_by:context.user.id,updated_at:new Date().toISOString()};if(!values.asset_tag)throw new Error("Asset tag is required");const updated=await context.admin.from("assets").update(values).eq("id",id);if(updated.error)throw updated.error;await audit({action:values.status==="retired"?"ASSET_RETIRED":"ASSET_UPDATED",entityType:"asset",entityId:id,oldValue:current.data,newValue:values});return NextResponse.json({ok:true});
    }
    if(action==="assign_asset"){
      const assetId=String(body.assetId||""),employeeId=String(body.employeeId||"");if(!assetId||!employeeId)throw new Error("Employee and available asset are required");const [asset,employee,existing]=await Promise.all([context.admin.from("assets").select(assetSelect).eq("id",assetId).in("status",["available","returned"]).single(),context.admin.from("employees").select("id").eq("id",employeeId).eq("status","active").single(),context.admin.from("asset_assignments").select("id").eq("asset_id",assetId).eq("status","assigned").maybeSingle()]);if(asset.error||!isAssetAvailable(asset.data))throw new Error("This asset is not available");if(employee.error)throw new Error("Select an active employee");if(existing.data)throw new Error("This asset is already assigned");
      const assignmentValues:Record<string,unknown>={asset_id:assetId,employee_id:employeeId,issued_date:String(body.issuedDate||new Date().toISOString().slice(0,10)),condition_at_issue:String(body.condition||asset.data.condition),notes:String(body.notes||"").trim()||null,assigned_by:context.user.id};if(body.expectedReturnDate)assignmentValues.expected_return_date=body.expectedReturnDate;
      const assigned=await context.admin.from("asset_assignments").insert(assignmentValues).select("id").single();if(assigned.error)throw assigned.error;const updated=await context.admin.from("assets").update({status:"assigned",updated_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",assetId).in("status",["available","returned"]);if(updated.error)throw updated.error;await audit({action:"ASSET_ASSIGNED",entityType:"assignment",entityId:assigned.data.id,employeeId,newValue:{assetId}});return NextResponse.json({ok:true});
    }
    if(action==="create_and_assign_asset"){
      const employeeId=String(body.employeeId||""),assetTag=String(body.assetTag||"").trim();if(!employeeId||!assetTag)throw new Error("Employee and asset tag are required");
      const created=await context.admin.from("assets").insert({item_id:String(body.itemId||""),brand:String(body.brand||"").trim()||null,model:String(body.model||"").trim()||null,serial_number:String(body.serialNumber||"").trim()||null,asset_tag:assetTag,purchased_at:body.purchasedAt||null,condition:String(body.condition||"good"),status:"assigned",notes:String(body.notes||"").trim()||null,created_by:context.user.id,updated_by:context.user.id}).select("id").single();if(created.error)throw created.error;
      const assigned=await context.admin.from("asset_assignments").insert({asset_id:created.data.id,employee_id:employeeId,issued_date:String(body.issuedDate||new Date().toISOString().slice(0,10)),condition_at_issue:String(body.condition||"good"),notes:String(body.notes||"").trim()||null,assigned_by:context.user.id}).select("id").single();if(assigned.error){await context.admin.from("assets").delete().eq("id",created.data.id);throw assigned.error;}await audit({action:"asset_created",entityType:"asset",entityId:created.data.id,employeeId,newValue:body});await audit({action:"asset_assigned",entityType:"assignment",entityId:assigned.data.id,employeeId,newValue:{assetId:created.data.id}});return NextResponse.json({ok:true,id:assigned.data.id});
    }
    if(action==="return_asset"){
      const assignmentId=String(body.assignmentId||"");const assignment=await context.admin.from("asset_assignments").select("*").eq("id",assignmentId).eq("status","assigned").single();if(assignment.error)throw assignment.error;const assetStatus=String(body.assetStatus||"available");
      const a=await context.admin.from("asset_assignments").update({status:"returned",returned_date:String(body.returnedDate||new Date().toISOString().slice(0,10)),condition_at_return:String(body.condition||"good"),returned_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",assignmentId);if(a.error)throw a.error;const b=await context.admin.from("assets").update({status:assetStatus,condition:String(body.condition||"good"),updated_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",assignment.data.asset_id);if(b.error)throw b.error;await audit({action:"asset_returned",entityType:"assignment",entityId:assignmentId,employeeId:assignment.data.employee_id,newValue:{assetStatus}});return NextResponse.json({ok:true});
    }
    if(action==="request_status"){
      const id=String(body.id||"");const next=String(body.status||"");if(!["approved","rejected","awaiting_issue","under_repair"].includes(next))throw new Error("Invalid request status");const current=await context.admin.from("asset_requests").select("*").eq("id",id).single();if(current.error)throw current.error;
      const values:Record<string,unknown>={status:next,admin_comment:String(body.comment||"").trim()||null,quantity_approved:nonNegativeQuantity(body.quantityApproved,current.data.quantity_requested),updated_at:new Date().toISOString()};if(["approved","rejected"].includes(next)){values.approved_by=context.user.id;values.approved_at=new Date().toISOString();}
      const updated=await context.admin.from("asset_requests").update(values).eq("id",id);if(updated.error)throw updated.error;await history(id,`request_${next}`,current.data.status,next,String(body.comment||""));await audit({action:`request_${next}`,entityType:"request",entityId:id,employeeId:current.data.employee_id,requestId:id,oldValue:{status:current.data.status},newValue:values});await notifyAssetRequest(context.admin,{type:next==="rejected"?"rejected":"approved",requestId:id}).catch(console.error);return NextResponse.json({ok:true});
    }
    if(action==="issue_request"){
      const id=String(body.id||"");const current=await context.admin.from("asset_requests").select("*,item:asset_items!asset_requests_item_id_fkey(*)").eq("id",id).single();if(current.error)throw current.error;if(!["approved","awaiting_issue","under_repair"].includes(current.data.status))throw new Error("Only an approved request can be issued");
      const item=current.data.item;const quantity=nonNegativeQuantity(current.data.quantity_approved,current.data.quantity_requested);const selectedAssetId=body.selectedAssetId?String(body.selectedAssetId):null;
      if(item.individually_tracked||item.item_type==="durable_asset"){
        if(!selectedAssetId)throw new Error("Select an available durable asset");const selected=await context.admin.from("assets").select("id,status,condition").eq("id",selectedAssetId).single();if(selected.error)throw selected.error;if(!["available","returned"].includes(selected.data.status))throw new Error("Selected asset is not available");
        if(current.data.existing_asset_id){const oldAssignment=await context.admin.from("asset_assignments").select("id").eq("asset_id",current.data.existing_asset_id).eq("employee_id",current.data.employee_id).eq("status","assigned").maybeSingle();if(oldAssignment.data){await context.admin.from("asset_assignments").update({status:"replaced",returned_date:new Date().toISOString().slice(0,10),returned_by:context.user.id}).eq("id",oldAssignment.data.id);}await context.admin.from("assets").update({status:String(body.oldAssetStatus||"returned"),updated_by:context.user.id}).eq("id",current.data.existing_asset_id);}
        const assigned=await context.admin.from("asset_assignments").insert({asset_id:selectedAssetId,employee_id:current.data.employee_id,request_id:id,issued_date:new Date().toISOString().slice(0,10),condition_at_issue:selected.data.condition,assigned_by:context.user.id}).select("id").single();if(assigned.error)throw assigned.error;await context.admin.from("assets").update({status:"assigned",updated_by:context.user.id}).eq("id",selectedAssetId);
      }else if(item.stock_tracked){if(item.current_stock<quantity)throw new Error("Insufficient stock");const balance=item.current_stock-quantity;const stock=await context.admin.from("asset_items").update({current_stock:balance,updated_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",item.id).eq("current_stock",item.current_stock);if(stock.error)throw stock.error;const tx=await context.admin.from("inventory_transactions").insert({item_id:item.id,request_id:id,transaction_type:"issue",quantity_delta:-quantity,balance_after:balance,actor_user_id:context.user.id});if(tx.error)throw tx.error;}
      const updated=await context.admin.from("asset_requests").update({status:"issued",selected_asset_id:selectedAssetId,issued_by:context.user.id,issued_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);if(updated.error)throw updated.error;await history(id,"request_issued",current.data.status,"issued",String(body.comment||""),{quantity,selectedAssetId});await audit({action:current.data.existing_asset_id?"asset_replaced":"request_issued",entityType:"request",entityId:id,employeeId:current.data.employee_id,requestId:id,newValue:{quantity,selectedAssetId}});await notifyAssetRequest(context.admin,{type:"issued",requestId:id}).catch(console.error);return NextResponse.json({ok:true});
    }
    if(action==="inventory_adjust"){
      const id=String(body.itemId||"");const item=await context.admin.from("asset_items").select("id,current_stock,stock_tracked").eq("id",id).single();if(item.error)throw item.error;if(!item.data.stock_tracked)throw new Error("Stock tracking is disabled for this item");const delta=Math.trunc(Number(body.delta));if(!Number.isFinite(delta)||delta===0)throw new Error("Enter a non-zero stock adjustment");const balance=item.data.current_stock+delta;if(balance<0)throw new Error("Stock cannot become negative");await context.admin.from("asset_items").update({current_stock:balance,updated_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",id);await context.admin.from("inventory_transactions").insert({item_id:id,transaction_type:"adjustment",quantity_delta:delta,balance_after:balance,actor_user_id:context.user.id,notes:String(body.notes||"").trim()||null});await audit({action:"inventory_adjusted",entityType:"item",entityId:id,oldValue:{stock:item.data.current_stock},newValue:{stock:balance}});return NextResponse.json({ok:true});
    }
    if(action==="save_category"){
      const values={name:String(body.name||"").trim(),description:String(body.description||"").trim()||null,active:body.active!==false,updated_by:context.user.id,updated_at:new Date().toISOString()};if(!values.name)throw new Error("Category name is required");const result=body.id?await context.admin.from("asset_categories").update(values).eq("id",String(body.id)):await context.admin.from("asset_categories").insert({...values,created_by:context.user.id});if(result.error)throw result.error;return NextResponse.json({ok:true});
    }
    if(action==="save_item"){
      const id=body.id?String(body.id):null,itemType=String(body.itemType||"accessory"),durable=itemType==="durable_asset";const currentStock=Math.max(0,Math.trunc(Number(body.currentStock)||0));const values={category_id:String(body.categoryId||""),name:String(body.name||"").trim(),item_type:itemType,brand:String(body.brand||"").trim()||null,model:String(body.model||"").trim()||null,notes:String(body.notes||"").trim()||null,stock_tracked:durable?false:Boolean(body.stockTracked),individually_tracked:durable||Boolean(body.individuallyTracked),current_stock:currentStock,minimum_stock_level:Math.max(0,Math.trunc(Number(body.minimumStockLevel)||0)),requires_approval:body.requiresApproval!==false,active:body.active!==false,updated_by:context.user.id,updated_at:new Date().toISOString()};if(!values.category_id||!values.name)throw new Error("Category and item name are required");const previous=id?await context.admin.from("asset_items").select("*").eq("id",id).single():null;if(previous?.error)throw previous.error;const result=id?await context.admin.from("asset_items").update(values).eq("id",id):await context.admin.from("asset_items").insert({...values,created_by:context.user.id}).select("id").single();if(result.error){if(result.error.code==="23505")throw new Error("An item with the same category, name, brand, and model already exists");throw result.error;}const entityId=id||("data" in result&&result.data?result.data.id:undefined);const previousStock=Number(previous?.data?.current_stock||0);if(id&&previousStock!==currentStock){const transaction=await context.admin.from("inventory_transactions").insert({item_id:id,transaction_type:"adjustment",quantity_delta:currentStock-previousStock,balance_after:currentStock,actor_user_id:context.user.id,notes:"Stock updated from catalogue item form"});if(transaction.error)throw transaction.error;}await audit({action:id?"ITEM_UPDATED":"ITEM_CREATED",entityType:"item",entityId,oldValue:previous?.data||null,newValue:values});return NextResponse.json({ok:true,id:entityId});
    }
    if(action==="deactivate_item"){
      const id=String(body.id||"");const current=await context.admin.from("asset_items").select("*").eq("id",id).single();if(current.error)throw current.error;const updated=await context.admin.from("asset_items").update({active:false,updated_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",id);if(updated.error)throw updated.error;await audit({action:"ITEM_DEACTIVATED",entityType:"item",entityId:id,oldValue:current.data,newValue:{active:false}});return NextResponse.json({ok:true});
    }
    return jsonError(new Error("Unsupported asset action"));
  }catch(cause){return jsonError(cause);}
}
