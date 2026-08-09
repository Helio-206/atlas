create schema if not exists documents;
create schema if not exists notifications;

create table documents.files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  project_id uuid not null,
  resource_type text not null,
  resource_id uuid not null,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references auth.users(id),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint documents_files_project_company_fk foreign key (project_id, company_id)
    references projects.projects(id, company_id),
  constraint documents_files_resource_type_check
    check (resource_type in ('quotation','purchase_order','goods_receipt')),
  constraint documents_files_name_check check (char_length(btrim(original_name)) between 1 and 255),
  constraint documents_files_mime_check check (mime_type in ('application/pdf','image/png','image/jpeg')),
  constraint documents_files_size_check check (size_bytes > 0 and size_bytes <= 10485760),
  constraint documents_files_status_check check (status in ('pending','ready'))
);
create index documents_files_company_resource_idx
  on documents.files(company_id, resource_type, resource_id, created_at desc);
create index documents_files_uploader_idx
  on documents.files(uploaded_by, created_at desc);

create table notifications.items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_audit_id uuid references audit.entries(id) on delete cascade,
  event_type text not null,
  title text not null,
  resource_type text,
  resource_id uuid,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_check check (char_length(btrim(title)) between 1 and 500),
  constraint notifications_href_check check (href is null or char_length(href) <= 1000),
  constraint notifications_source_user_event_unique unique(user_id, source_audit_id, event_type)
);
create index notifications_user_unread_idx
  on notifications.items(user_id, created_at desc) where read_at is null;
create index notifications_company_created_idx
  on notifications.items(company_id, created_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'atlas-documents',
  'atlas-documents',
  false,
  10485760,
  array['application/pdf','image/png','image/jpeg']::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function platform.procurement_permissions()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := platform.current_procurement_role();
begin
  case v_role
    when 'administrator' then
      return array[
        'Procurement.View','Procurement.Create','Procurement.EditOwn','Procurement.Submit',
        'Procurement.TechnicalApprove','Procurement.FinancialApprove','Procurement.ExecutiveApprove','Procurement.Cancel',
        'Procurement.SupplierView','Procurement.SupplierManage','Procurement.QuotationView','Procurement.QuotationManage','Procurement.SupplierSelect',
        'Procurement.PurchaseOrderView','Procurement.PurchaseOrderIssue','Procurement.GoodsReceiptView','Procurement.GoodsReceiptCreate'
      ]::text[];
    when 'project_manager' then
      return array[
        'Procurement.View','Procurement.SupplierView','Procurement.QuotationView',
        'Procurement.PurchaseOrderView','Procurement.GoodsReceiptView'
      ]::text[];
    when 'requester' then
      return array[
        'Procurement.View','Procurement.Create','Procurement.EditOwn','Procurement.Submit','Procurement.Cancel',
        'Procurement.SupplierView','Procurement.QuotationView',
        'Procurement.PurchaseOrderView','Procurement.GoodsReceiptView'
      ]::text[];
    when 'technical_reviewer' then
      return array[
        'Procurement.View','Procurement.TechnicalApprove','Procurement.SupplierView','Procurement.QuotationView',
        'Procurement.PurchaseOrderView','Procurement.GoodsReceiptView'
      ]::text[];
    when 'financial_approver' then
      return array[
        'Procurement.View','Procurement.FinancialApprove','Procurement.SupplierView','Procurement.QuotationView',
        'Procurement.PurchaseOrderView','Procurement.GoodsReceiptView'
      ]::text[];
    when 'executive_approver' then
      return array[
        'Procurement.View','Procurement.ExecutiveApprove','Procurement.SupplierView','Procurement.QuotationView',
        'Procurement.PurchaseOrderView','Procurement.GoodsReceiptView'
      ]::text[];
    when 'procurement_officer' then
      return array[
        'Procurement.View','Procurement.SupplierView','Procurement.SupplierManage','Procurement.QuotationView','Procurement.QuotationManage','Procurement.SupplierSelect',
        'Procurement.PurchaseOrderView','Procurement.PurchaseOrderIssue','Procurement.GoodsReceiptView','Procurement.GoodsReceiptCreate'
      ]::text[];
    when 'warehouse_operator' then
      return array[
        'Procurement.View','Procurement.PurchaseOrderView','Procurement.GoodsReceiptView','Procurement.GoodsReceiptCreate'
      ]::text[];
    else
      return array[]::text[];
  end case;
end;
$$;

create or replace function platform.document_resource_context(p_resource_type text,p_resource_id uuid)
returns table(company_id uuid,project_id uuid)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  case p_resource_type
    when 'quotation' then
      return query
      select q.company_id,r.project_id
      from procurement.quotations q
      join procurement.purchase_requests r on r.id=q.purchase_request_id and r.company_id=q.company_id
      where q.id=p_resource_id;
    when 'purchase_order' then
      return query
      select po.company_id,r.project_id
      from procurement.purchase_orders po
      join procurement.purchase_requests r on r.id=po.purchase_request_id and r.company_id=po.company_id
      where po.id=p_resource_id;
    when 'goods_receipt' then
      return query
      select gr.company_id,r.project_id
      from procurement.goods_receipts gr
      join procurement.purchase_orders po on po.id=gr.purchase_order_id and po.company_id=gr.company_id
      join procurement.purchase_requests r on r.id=po.purchase_request_id and r.company_id=gr.company_id
      where gr.id=p_resource_id;
    else
      return;
  end case;
end;
$$;
revoke all on function platform.document_resource_context(text,uuid) from public,anon,authenticated;

create or replace function platform.can_access_document_resource(p_resource_type text,p_resource_id uuid,p_mode text default 'view')
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_company uuid;
  v_resource_company uuid;
  v_permission text;
begin
  if auth.uid() is null then return false; end if;
  begin
    v_company:=platform.current_company_id();
  exception when others then
    return false;
  end;

  select ctx.company_id into v_resource_company
  from platform.document_resource_context(p_resource_type,p_resource_id) ctx;
  if v_resource_company is null or v_resource_company<>v_company then return false; end if;

  if p_mode='view' then
    v_permission:=case p_resource_type
      when 'quotation' then 'Procurement.QuotationView'
      when 'purchase_order' then 'Procurement.PurchaseOrderView'
      when 'goods_receipt' then 'Procurement.GoodsReceiptView'
    end;
  elsif p_mode='upload' then
    v_permission:=case p_resource_type
      when 'quotation' then 'Procurement.QuotationManage'
      when 'purchase_order' then 'Procurement.PurchaseOrderIssue'
      when 'goods_receipt' then 'Procurement.GoodsReceiptCreate'
    end;
  else
    return false;
  end if;

  return v_permission is not null and platform.procurement_has_permission(v_permission);
end;
$$;
revoke all on function platform.can_access_document_resource(text,uuid,text) from public,anon;
grant execute on function platform.can_access_document_resource(text,uuid,text) to authenticated;

create or replace function platform.prepare_document_upload(
  p_resource_type text,p_resource_id uuid,p_original_name text,p_mime_type text,p_size_bytes bigint
)
returns table(document_id uuid,storage_path text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_company uuid;
  v_project uuid;
  v_user uuid:=auth.uid();
  v_id uuid:=gen_random_uuid();
  v_extension text;
  v_original text;
begin
  if v_user is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if not platform.can_access_document_resource(p_resource_type,p_resource_id,'upload') then
    raise exception using errcode='42501',message='document_upload_forbidden';
  end if;
  if p_mime_type not in ('application/pdf','image/png','image/jpeg') then
    raise exception using errcode='22023',message='document_mime_not_allowed';
  end if;
  if p_resource_type='quotation' and p_mime_type<>'application/pdf' then
    raise exception using errcode='22023',message='quotation_document_must_be_pdf';
  end if;
  if p_size_bytes is null or p_size_bytes<=0 or p_size_bytes>10485760 then
    raise exception using errcode='22023',message='document_size_invalid';
  end if;
  v_original:=btrim(replace(replace(coalesce(p_original_name,''),E'\n',' '),E'\r',' '));
  if char_length(v_original)<1 or char_length(v_original)>255 then
    raise exception using errcode='22023',message='document_name_invalid';
  end if;

  select ctx.company_id,ctx.project_id into v_company,v_project
  from platform.document_resource_context(p_resource_type,p_resource_id) ctx;
  if v_company is null then raise exception using errcode='P0001',message='document_resource_not_found'; end if;

  v_extension:=case p_mime_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end;
  storage_path:=v_company::text||'/'||v_id::text||v_extension;

  insert into documents.files(
    id,company_id,project_id,resource_type,resource_id,storage_path,original_name,mime_type,size_bytes,uploaded_by,status
  ) values(
    v_id,v_company,v_project,p_resource_type,p_resource_id,storage_path,v_original,p_mime_type,p_size_bytes,v_user,'pending'
  );
  document_id:=v_id;
  return next;
end;
$$;

create or replace function platform.finalize_document_upload(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_file documents.files%rowtype;
begin
  select f.* into v_file from documents.files f where f.id=p_document_id for update;
  if not found then raise exception using errcode='P0001',message='document_not_found'; end if;
  if v_file.uploaded_by<>auth.uid() or not platform.can_access_document_resource(v_file.resource_type,v_file.resource_id,'upload') then
    raise exception using errcode='42501',message='document_upload_forbidden';
  end if;
  if v_file.status<>'pending' then raise exception using errcode='P0001',message='document_already_finalized'; end if;
  update documents.files set status='ready' where id=p_document_id;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_file.company_id,auth.uid(),'DocumentUploaded','documents',v_file.resource_type,v_file.resource_id,
    jsonb_build_object('documentId',p_document_id,'mimeType',v_file.mime_type,'sizeBytes',v_file.size_bytes));
end;
$$;

create or replace function platform.discard_document_upload(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_file documents.files%rowtype;
begin
  select f.* into v_file from documents.files f where f.id=p_document_id for update;
  if not found then return; end if;
  if v_file.uploaded_by<>auth.uid() or v_file.status<>'pending' then
    raise exception using errcode='42501',message='document_discard_forbidden';
  end if;
  delete from documents.files where id=p_document_id;
end;
$$;

create or replace function platform.list_resource_documents(p_resource_type text,p_resource_id uuid)
returns table(id uuid,original_name text,mime_type text,size_bytes bigint,uploaded_by uuid,created_at timestamptz)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not platform.can_access_document_resource(p_resource_type,p_resource_id,'view') then
    return;
  end if;
  return query
  select f.id,f.original_name,f.mime_type,f.size_bytes,f.uploaded_by,f.created_at
  from documents.files f
  where f.resource_type=p_resource_type and f.resource_id=p_resource_id and f.status='ready'
    and f.company_id=(select ctx.company_id from platform.document_resource_context(p_resource_type,p_resource_id) ctx)
  order by f.created_at desc,f.id desc;
end;
$$;

create or replace function platform.get_document_download(p_document_id uuid)
returns table(storage_path text,original_name text,mime_type text)
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_file documents.files%rowtype;
begin
  select f.* into v_file from documents.files f where f.id=p_document_id and f.status='ready';
  if not found then return; end if;
  if not platform.can_access_document_resource(v_file.resource_type,v_file.resource_id,'view') then
    raise exception using errcode='42501',message='document_view_forbidden';
  end if;
  return query select v_file.storage_path,v_file.original_name,v_file.mime_type;
end;
$$;

create or replace function platform.can_access_document_object(p_storage_path text,p_mode text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_file documents.files%rowtype;
begin
  select f.* into v_file from documents.files f where f.storage_path=p_storage_path;
  if not found then return false; end if;
  if p_mode='read' then
    return v_file.status='ready' and platform.can_access_document_resource(v_file.resource_type,v_file.resource_id,'view');
  end if;
  if p_mode in ('upload','delete') then
    return v_file.status='pending' and v_file.uploaded_by=auth.uid()
      and platform.can_access_document_resource(v_file.resource_type,v_file.resource_id,'upload');
  end if;
  return false;
end;
$$;
revoke all on function platform.can_access_document_object(text,text) from public,anon;
grant execute on function platform.can_access_document_object(text,text) to authenticated;

alter table documents.files enable row level security;
create policy documents_files_select_company on documents.files for select to authenticated
using(platform.can_access_document_resource(resource_type,resource_id,'view'));
revoke all on documents.files from public,anon;
revoke insert,update,delete,truncate,references,trigger on documents.files from authenticated;
grant usage on schema documents to authenticated;
grant select on documents.files to authenticated;

create policy atlas_documents_select on storage.objects for select to authenticated
using(bucket_id='atlas-documents' and platform.can_access_document_object(name,'read'));
create policy atlas_documents_insert on storage.objects for insert to authenticated
with check(bucket_id='atlas-documents' and platform.can_access_document_object(name,'upload'));
create policy atlas_documents_delete on storage.objects for delete to authenticated
using(bucket_id='atlas-documents' and platform.can_access_document_object(name,'delete'));

create or replace function public.prepare_document_upload(resource_type text,resource_id uuid,original_name text,mime_type text,size_bytes bigint)
returns table(document_id uuid,storage_path text)
language sql security invoker set search_path=''
as $$select * from platform.prepare_document_upload($1,$2,$3,$4,$5);$$;
create or replace function public.finalize_document_upload(document_id uuid)
returns void language sql security invoker set search_path=''
as $$select platform.finalize_document_upload($1);$$;
create or replace function public.discard_document_upload(document_id uuid)
returns void language sql security invoker set search_path=''
as $$select platform.discard_document_upload($1);$$;
create or replace function public.list_resource_documents(resource_type text,resource_id uuid)
returns table(id uuid,original_name text,mime_type text,size_bytes bigint,uploaded_by uuid,created_at timestamptz)
language sql stable security invoker set search_path=''
as $$select * from platform.list_resource_documents($1,$2);$$;
create or replace function public.get_document_download(document_id uuid)
returns table(storage_path text,original_name text,mime_type text)
language sql stable security invoker set search_path=''
as $$select * from platform.get_document_download($1);$$;

revoke all on function
  platform.prepare_document_upload(text,uuid,text,text,bigint),
  platform.finalize_document_upload(uuid),
  platform.discard_document_upload(uuid),
  platform.list_resource_documents(text,uuid),
  platform.get_document_download(uuid)
from public,anon;
grant execute on function
  platform.prepare_document_upload(text,uuid,text,text,bigint),
  platform.finalize_document_upload(uuid),
  platform.discard_document_upload(uuid),
  platform.list_resource_documents(text,uuid),
  platform.get_document_download(uuid)
to authenticated;
revoke all on function
  public.prepare_document_upload(text,uuid,text,text,bigint),
  public.finalize_document_upload(uuid),
  public.discard_document_upload(uuid),
  public.list_resource_documents(text,uuid),
  public.get_document_download(uuid)
from public,anon;
grant execute on function
  public.prepare_document_upload(text,uuid,text,text,bigint),
  public.finalize_document_upload(uuid),
  public.discard_document_upload(uuid),
  public.list_resource_documents(text,uuid),
  public.get_document_download(uuid)
to authenticated;

create or replace function platform.notify_user(
  p_company_id uuid,p_user_id uuid,p_source_audit_id uuid,p_event_type text,p_title text,p_resource_type text,p_resource_id uuid,p_href text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_user_id is null then return; end if;
  if not exists(select 1 from identity.memberships m where m.company_id=p_company_id and m.user_id=p_user_id and m.status='active') then return; end if;
  insert into notifications.items(company_id,user_id,source_audit_id,event_type,title,resource_type,resource_id,href)
  values(p_company_id,p_user_id,p_source_audit_id,p_event_type,p_title,p_resource_type,p_resource_id,p_href)
  on conflict(user_id,source_audit_id,event_type) do nothing;
end;
$$;
revoke all on function platform.notify_user(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon,authenticated;

create or replace function platform.notify_role(
  p_company_id uuid,p_role text,p_source_audit_id uuid,p_event_type text,p_title text,p_resource_type text,p_resource_id uuid,p_href text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid;
begin
  for v_user in select m.user_id from identity.memberships m where m.company_id=p_company_id and m.role=p_role and m.status='active'
  loop
    perform platform.notify_user(p_company_id,v_user,p_source_audit_id,p_event_type,p_title,p_resource_type,p_resource_id,p_href);
  end loop;
end;
$$;
revoke all on function platform.notify_role(uuid,text,uuid,text,text,text,uuid,text) from public,anon,authenticated;

create or replace function platform.audit_notification_dispatch()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_request procurement.purchase_requests%rowtype;
  v_order procurement.purchase_orders%rowtype;
  v_href text;
begin
  if new.action in ('PurchaseRequestSubmitted','TechnicalApprovalGranted','FinancialApprovalGranted','PurchaseRequestReturned','PurchaseRequestRejected','SupplierSelected') then
    select r.* into v_request from procurement.purchase_requests r where r.id=new.resource_id and r.company_id=new.company_id;
  elsif new.action='PurchaseOrderIssued' then
    select po.* into v_order from procurement.purchase_orders po where po.id=new.resource_id and po.company_id=new.company_id;
    if found then select r.* into v_request from procurement.purchase_requests r where r.id=v_order.purchase_request_id and r.company_id=new.company_id; end if;
  else
    return new;
  end if;

  if v_request.id is null then return new; end if;
  v_href:='/dashboard/procurement/'||v_request.id::text;

  case new.action
    when 'PurchaseRequestSubmitted' then
      perform platform.notify_user(new.company_id,v_request.requested_by,new.id,'PurchaseRequestSubmitted',v_request.request_number||' foi submetida','purchase_request',v_request.id,v_href);
      perform platform.notify_role(new.company_id,'technical_reviewer',new.id,'TechnicalReviewPending',v_request.request_number||' aguarda sua aprovação técnica','purchase_request',v_request.id,v_href);
    when 'TechnicalApprovalGranted' then
      perform platform.notify_role(new.company_id,'financial_approver',new.id,'FinancialReviewPending',v_request.request_number||' aguarda sua aprovação financeira','purchase_request',v_request.id,v_href);
    when 'FinancialApprovalGranted' then
      if new.metadata->>'to_status'='executive_review' then
        perform platform.notify_role(new.company_id,'executive_approver',new.id,'ExecutiveReviewPending',v_request.request_number||' aguarda sua aprovação executiva','purchase_request',v_request.id,v_href);
      end if;
    when 'PurchaseRequestReturned' then
      perform platform.notify_user(new.company_id,v_request.requested_by,new.id,'PurchaseRequestReturned',v_request.request_number||' foi devolvida para correção','purchase_request',v_request.id,v_href);
    when 'PurchaseRequestRejected' then
      perform platform.notify_user(new.company_id,v_request.requested_by,new.id,'PurchaseRequestRejected',v_request.request_number||' foi rejeitada','purchase_request',v_request.id,v_href);
    when 'SupplierSelected' then
      perform platform.notify_user(new.company_id,v_request.requested_by,new.id,'SupplierSelected','Fornecedor selecionado para '||v_request.request_number,'purchase_request',v_request.id,v_href);
    when 'PurchaseOrderIssued' then
      v_href:='/dashboard/purchase-orders/'||v_order.id::text;
      perform platform.notify_user(new.company_id,v_request.requested_by,new.id,'PurchaseOrderIssued',v_order.order_number||' foi emitida','purchase_order',v_order.id,v_href);
      perform platform.notify_role(new.company_id,'warehouse_operator',new.id,'PurchaseOrderIssued',v_order.order_number||' foi emitida e aguarda receção','purchase_order',v_order.id,v_href);
  end case;
  return new;
end;
$$;
revoke all on function platform.audit_notification_dispatch() from public,anon,authenticated;
drop trigger if exists on_audit_notification_dispatch on audit.entries;
create trigger on_audit_notification_dispatch after insert on audit.entries
for each row execute function platform.audit_notification_dispatch();

create or replace function platform.list_notifications(p_limit integer default 20)
returns table(id uuid,event_type text,title text,resource_type text,resource_id uuid,href text,read_at timestamptz,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_limit integer:=greatest(1,least(coalesce(p_limit,20),100));
begin
  v_company:=platform.current_company_id();
  return query select n.id,n.event_type,n.title,n.resource_type,n.resource_id,n.href,n.read_at,n.created_at
  from notifications.items n where n.company_id=v_company and n.user_id=v_user
  order by n.created_at desc,n.id desc limit v_limit;
end;
$$;
create or replace function platform.count_unread_notifications()
returns integer language plpgsql stable security definer set search_path=''
as $$declare v_company uuid;begin v_company:=platform.current_company_id(); return (select count(*)::integer from notifications.items n where n.company_id=v_company and n.user_id=auth.uid() and n.read_at is null);end;$$;
create or replace function platform.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path=''
as $$declare v_company uuid;begin v_company:=platform.current_company_id(); update notifications.items n set read_at=coalesce(n.read_at,now()) where n.id=p_notification_id and n.company_id=v_company and n.user_id=auth.uid(); if not found then raise exception using errcode='P0001',message='notification_not_found'; end if;end;$$;

alter table notifications.items enable row level security;
create policy notifications_select_own on notifications.items for select to authenticated
using(user_id=(select auth.uid()) and identity.is_company_member(company_id));
revoke all on notifications.items from public,anon;
revoke insert,update,delete,truncate,references,trigger on notifications.items from authenticated;
grant usage on schema notifications to authenticated;
grant select on notifications.items to authenticated;

create or replace function public.list_notifications(max_items integer default 20)
returns table(id uuid,event_type text,title text,resource_type text,resource_id uuid,href text,read_at timestamptz,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from platform.list_notifications($1);$$;
create or replace function public.count_unread_notifications()
returns integer language sql stable security invoker set search_path='' as $$select platform.count_unread_notifications();$$;
create or replace function public.mark_notification_read(notification_id uuid)
returns void language sql security invoker set search_path='' as $$select platform.mark_notification_read($1);$$;
revoke all on function platform.list_notifications(integer),platform.count_unread_notifications(),platform.mark_notification_read(uuid) from public,anon;
grant execute on function platform.list_notifications(integer),platform.count_unread_notifications(),platform.mark_notification_read(uuid) to authenticated;
revoke all on function public.list_notifications(integer),public.count_unread_notifications(),public.mark_notification_read(uuid) from public,anon;
grant execute on function public.list_notifications(integer),public.count_unread_notifications(),public.mark_notification_read(uuid) to authenticated;

create or replace function platform.list_company_members()
returns table(membership_id uuid,user_id uuid,full_name text,email text,role text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$declare v_company uuid;begin
  if platform.current_procurement_role()<>'administrator' then raise exception using errcode='42501',message='administrator_required'; end if;
  v_company:=platform.current_company_id();
  return query select m.id,m.user_id,p.full_name,u.email::text,m.role,m.status,m.created_at
  from identity.memberships m join auth.users u on u.id=m.user_id left join identity.profiles p on p.id=m.user_id
  where m.company_id=v_company order by p.full_name nulls last,u.email;
end;$$;

create or replace function platform.set_company_membership_status(p_membership_id uuid,p_expected_status text,p_status text)
returns void language plpgsql security definer set search_path=''
as $$declare v_company uuid; v_member identity.memberships%rowtype;begin
  if platform.current_procurement_role()<>'administrator' then raise exception using errcode='42501',message='administrator_required'; end if;
  if p_status not in ('active','suspended') then raise exception using errcode='22023',message='invalid_membership_status'; end if;
  v_company:=platform.current_company_id();
  select m.* into v_member from identity.memberships m where m.id=p_membership_id and m.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='membership_not_found'; end if;
  if v_member.status<>p_expected_status then raise exception using errcode='40001',message='membership_status_conflict'; end if;
  if v_member.user_id=auth.uid() and p_status='suspended' then raise exception using errcode='42501',message='cannot_suspend_self'; end if;
  update identity.memberships set status=p_status where id=p_membership_id and status=p_expected_status;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,auth.uid(),'MembershipStatusChanged','identity','membership',p_membership_id,jsonb_build_object('fromStatus',p_expected_status,'toStatus',p_status,'memberUserId',v_member.user_id));
end;$$;

create or replace function platform.list_company_audit(p_limit integer default 100)
returns table(id uuid,action text,module text,resource_type text,resource_id uuid,user_id uuid,user_name text,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$declare v_company uuid;v_limit integer:=greatest(1,least(coalesce(p_limit,100),200));begin
  if platform.current_procurement_role()<>'administrator' then raise exception using errcode='42501',message='administrator_required'; end if;
  v_company:=platform.current_company_id();
  return query select e.id,e.action,e.module,e.resource_type,e.resource_id,e.user_id,p.full_name,e.metadata,e.created_at
  from audit.entries e left join identity.profiles p on p.id=e.user_id
  where e.company_id=v_company order by e.created_at desc,e.id desc limit v_limit;
end;$$;

create or replace function public.list_company_members()
returns table(membership_id uuid,user_id uuid,full_name text,email text,role text,status text,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from platform.list_company_members();$$;
create or replace function public.set_company_membership_status(membership_id uuid,expected_status text,status text)
returns void language sql security invoker set search_path='' as $$select platform.set_company_membership_status($1,$2,$3);$$;
create or replace function public.list_company_audit(max_items integer default 100)
returns table(id uuid,action text,module text,resource_type text,resource_id uuid,user_id uuid,user_name text,metadata jsonb,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from platform.list_company_audit($1);$$;
revoke all on function platform.list_company_members(),platform.set_company_membership_status(uuid,text,text),platform.list_company_audit(integer) from public,anon;
grant execute on function platform.list_company_members(),platform.set_company_membership_status(uuid,text,text),platform.list_company_audit(integer) to authenticated;
revoke all on function public.list_company_members(),public.set_company_membership_status(uuid,text,text),public.list_company_audit(integer) from public,anon;
grant execute on function public.list_company_members(),public.set_company_membership_status(uuid,text,text),public.list_company_audit(integer) to authenticated;

-- Fix the Sprint 4 PL/pgSQL lint warning by keeping enum assignment explicitly typed.
create or replace function platform.record_goods_receipt(
  p_purchase_order_id uuid,
  p_expected_version integer,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_user uuid := auth.uid();
  v_order procurement.purchase_orders%rowtype;
  v_request procurement.purchase_requests%rowtype;
  v_order_item procurement.purchase_order_items%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_quantity numeric(18,4);
  v_previously_received numeric(18,4);
  v_receipt_id uuid;
  v_receipt_number text;
  v_complete boolean;
  v_receipt_status text;
  v_next_order_status text;
  v_next_request_status procurement.purchase_request_status;
  v_new_order_version integer;
  v_item_count integer := 0;
begin
  perform platform.require_procurement_permission('Procurement.GoodsReceiptCreate');
  v_company := platform.current_company_id();
  select purchase_order.* into v_order from procurement.purchase_orders purchase_order
  where purchase_order.id=p_purchase_order_id and purchase_order.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='purchase_order_not_found'; end if;
  if v_order.version<>p_expected_version then raise exception using errcode='40001',message='purchase_order_version_conflict'; end if;
  if v_order.status not in ('issued','partially_received') then raise exception using errcode='P0001',message='purchase_order_not_receivable'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception using errcode='22023',message='goods_receipt_items_required'; end if;
  if p_notes is not null and char_length(p_notes)>2000 then raise exception using errcode='22023',message='goods_receipt_notes_too_long'; end if;
  select request.* into v_request from procurement.purchase_requests request
  where request.id=v_order.purchase_request_id and request.company_id=v_company for update;
  if not found or v_request.status not in ('ordered','partially_received') then raise exception using errcode='P0001',message='purchase_request_receipt_state_invalid'; end if;

  v_receipt_number:=platform.next_procurement_document_number(v_company,'GR');
  insert into procurement.goods_receipts(company_id,purchase_order_id,receipt_number,received_by,received_at,notes,status)
  values(v_company,p_purchase_order_id,v_receipt_number,v_user,now(),nullif(btrim(p_notes),''),'partial') returning id into v_receipt_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_id:=(v_item->>'purchaseOrderItemId')::uuid;
    v_quantity:=(v_item->>'quantityReceived')::numeric;
    if v_quantity is null or v_quantity<=0 then raise exception using errcode='22023',message='invalid_goods_receipt_quantity'; end if;
    select item.* into v_order_item from procurement.purchase_order_items item where item.id=v_item_id and item.purchase_order_id=p_purchase_order_id;
    if not found then raise exception using errcode='P0001',message='purchase_order_item_not_found'; end if;
    select coalesce(sum(receipt_item.quantity_received),0)::numeric(18,4) into v_previously_received
    from procurement.goods_receipt_items receipt_item where receipt_item.purchase_order_item_id=v_item_id;
    if v_quantity>(v_order_item.quantity-v_previously_received) then raise exception using errcode='22023',message='goods_receipt_over_quantity'; end if;
    insert into procurement.goods_receipt_items(goods_receipt_id,purchase_order_item_id,quantity_received) values(v_receipt_id,v_item_id,v_quantity);
    v_item_count:=v_item_count+1;
  end loop;

  v_complete:=not exists(
    select 1 from procurement.purchase_order_items item where item.purchase_order_id=p_purchase_order_id
      and coalesce((select sum(receipt_item.quantity_received) from procurement.goods_receipt_items receipt_item where receipt_item.purchase_order_item_id=item.id),0)<item.quantity
  );
  v_receipt_status:=case when v_complete then 'complete' else 'partial' end;
  v_next_order_status:=case when v_complete then 'received' else 'partially_received' end;
  v_next_request_status:=case when v_complete
    then 'received'::procurement.purchase_request_status
    else 'partially_received'::procurement.purchase_request_status end;

  update procurement.goods_receipts set status=v_receipt_status where id=v_receipt_id;
  update procurement.purchase_orders purchase_order set status=v_next_order_status,updated_at=now(),version=purchase_order.version+1
  where purchase_order.id=p_purchase_order_id and purchase_order.version=p_expected_version returning version into v_new_order_version;
  if not found then raise exception using errcode='40001',message='purchase_order_version_conflict'; end if;
  update procurement.purchase_requests request set status=v_next_request_status,updated_at=now(),version=request.version+1
  where request.id=v_order.purchase_request_id and request.company_id=v_company;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'GoodsReceiptRecorded','procurement','goods_receipt',v_receipt_id,jsonb_build_object('purchaseOrderId',p_purchase_order_id,'receiptNumber',v_receipt_number,'status',v_receipt_status,'itemCount',v_item_count));
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,case when v_complete then 'PurchaseOrderReceived' else 'PurchaseOrderPartiallyReceived' end,'procurement','purchase_order',p_purchase_order_id,jsonb_build_object('receiptId',v_receipt_id,'fromStatus',v_order.status,'toStatus',v_next_order_status,'version',v_new_order_version));
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,case when v_complete then 'PurchaseRequestReceived' else 'PurchaseRequestPartiallyReceived' end,'procurement','purchase_request',v_order.purchase_request_id,jsonb_build_object('purchaseOrderId',p_purchase_order_id,'receiptId',v_receipt_id,'fromStatus',v_request.status,'toStatus',v_next_request_status));
  return v_receipt_id;
end;
$$;
revoke all on function platform.record_goods_receipt(uuid,integer,text,jsonb) from public,anon;
grant execute on function platform.record_goods_receipt(uuid,integer,text,jsonb) to authenticated;

create or replace function platform.seed_atlas_demo_data()
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  c constant uuid:='d0000000-0000-4000-8000-000000000001'::uuid;
  p1 constant uuid:='d1000000-0000-4000-8000-000000000001'::uuid;
  p2 constant uuid:='d1000000-0000-4000-8000-000000000002'::uuid;
  p3 constant uuid:='d1000000-0000-4000-8000-000000000003'::uuid;
  u_admin uuid;u_project uuid;u_requester uuid;u_technical uuid;u_finance uuid;u_director uuid;u_procurement uuid;u_warehouse uuid;
  s1 constant uuid:='d2000000-0000-4000-8000-000000000001'::uuid;
  s2 constant uuid:='d2000000-0000-4000-8000-000000000002'::uuid;
  s3 constant uuid:='d2000000-0000-4000-8000-000000000003'::uuid;
  s4 constant uuid:='d2000000-0000-4000-8000-000000000004'::uuid;
  s5 constant uuid:='d2000000-0000-4000-8000-000000000005'::uuid;
begin
  select id into u_admin from auth.users where email='admin@atlas.demo';
  select id into u_project from auth.users where email='project.manager@atlas.demo';
  select id into u_requester from auth.users where email='requester@atlas.demo';
  select id into u_technical from auth.users where email='technical@atlas.demo';
  select id into u_finance from auth.users where email='finance@atlas.demo';
  select id into u_director from auth.users where email='director@atlas.demo';
  select id into u_procurement from auth.users where email='procurement@atlas.demo';
  select id into u_warehouse from auth.users where email='warehouse@atlas.demo';
  if u_admin is null or u_project is null or u_requester is null or u_technical is null or u_finance is null or u_director is null or u_procurement is null or u_warehouse is null then
    raise exception using errcode='P0001',message='demo_users_required';
  end if;

  delete from notifications.items where company_id=c;
  delete from documents.files where company_id=c;
  delete from audit.entries where company_id=c;
  delete from procurement.goods_receipt_items gri using procurement.goods_receipts gr where gri.goods_receipt_id=gr.id and gr.company_id=c;
  delete from procurement.goods_receipts where company_id=c;
  delete from procurement.purchase_order_items poi using procurement.purchase_orders po where poi.purchase_order_id=po.id and po.company_id=c;
  delete from procurement.purchase_orders where company_id=c;
  delete from procurement.supplier_selections where company_id=c;
  delete from procurement.quotation_items qi using procurement.quotations q where qi.quotation_id=q.id and q.company_id=c;
  delete from procurement.quotations where company_id=c;
  delete from procurement.approval_decisions where company_id=c;
  delete from procurement.purchase_request_items pri using procurement.purchase_requests pr where pri.purchase_request_id=pr.id and pr.company_id=c;
  delete from procurement.purchase_requests where company_id=c;
  delete from procurement.suppliers where company_id=c;
  delete from projects.projects where company_id=c;
  delete from procurement.approval_settings where company_id=c;
  delete from platform.procurement_document_sequences where company_id=c;
  delete from identity.memberships where company_id=c;

  insert into identity.companies(id,name,tax_number,created_by,created_at,updated_at)
  values(c,'Construtora Horizonte, Lda.','5410000000',u_admin,now()-interval '60 days',now())
  on conflict(id) do update set name=excluded.name,tax_number=excluded.tax_number,created_by=excluded.created_by,updated_at=now();

  insert into identity.profiles(id,full_name,created_at,updated_at) values
    (u_admin,'Helena Manuel',now(),now()),(u_project,'Paulo Domingos',now(),now()),(u_requester,'Marta André',now(),now()),
    (u_technical,'Carlos Mateus',now(),now()),(u_finance,'Inês Joaquim',now(),now()),(u_director,'António Neto',now(),now()),
    (u_procurement,'Sofia Miguel',now(),now()),(u_warehouse,'Daniel Costa',now(),now())
  on conflict(id) do update set full_name=excluded.full_name,updated_at=now();

  insert into identity.memberships(company_id,user_id,role,status) values
    (c,u_admin,'administrator','active'),(c,u_project,'project_manager','active'),(c,u_requester,'requester','active'),
    (c,u_technical,'technical_reviewer','active'),(c,u_finance,'financial_approver','active'),(c,u_director,'executive_approver','active'),
    (c,u_procurement,'procurement_officer','active'),(c,u_warehouse,'warehouse_operator','active');

  insert into procurement.approval_settings(company_id,executive_approval_threshold,currency,updated_at)
  values(c,5000000,'AOA',now())
  on conflict (company_id) do update set
    executive_approval_threshold=excluded.executive_approval_threshold,
    currency=excluded.currency,
    updated_at=excluded.updated_at;

  insert into projects.projects(id,company_id,code,name,client_name,location,start_date,end_date,status,created_by,created_at,updated_at,version) values
    (p1,c,'AUR-26','Edifício Aurora','Horizonte Imobiliária','Talatona, Luanda','2026-01-15','2027-08-30','active',u_project,now()-interval '120 days',now(),2),
    (p2,c,'RDV-26','Residências do Vale','Vale Urbano','Kilamba, Luanda','2026-03-01','2027-02-28','active',u_project,now()-interval '90 days',now(),2),
    (p3,c,'CLH-26','Centro Logístico Horizonte','Horizonte Logística','Viana, Luanda','2026-05-20','2027-05-20','active',u_project,now()-interval '60 days',now(),2);

  insert into procurement.suppliers(id,company_id,name,tax_number,email,phone,address,status,created_by,created_at,updated_at,version) values
    (s1,c,'NovaBetão, Lda.','500100001','comercial@novabetao.demo','+244 923 100 101','Viana, Luanda','active',u_procurement,now()-interval '80 days',now(),1),
    (s2,c,'Kwanza Steel','500100002','vendas@kwanzasteel.demo','+244 923 100 102','Cacuaco, Luanda','active',u_procurement,now()-interval '75 days',now(),1),
    (s3,c,'ConstruSul','500100003','propostas@construsul.demo','+244 923 100 103','Talatona, Luanda','active',u_procurement,now()-interval '70 days',now(),1),
    (s4,c,'AngoCimento','500100004','comercial@angocimento.demo','+244 923 100 104','Catete, Icolo e Bengo','active',u_procurement,now()-interval '65 days',now(),1),
    (s5,c,'TecnoMateriais','500100005','vendas@tecnomateriais.demo','+244 923 100 105','Maianga, Luanda','active',u_procurement,now()-interval '60 days',now(),1);

  insert into procurement.purchase_requests(id,company_id,project_id,request_number,requested_by,purpose,priority,required_date,status,estimated_total,currency,current_approver_role,created_at,updated_at,submitted_at,approved_at,version) values
    ('d3000000-0000-4000-8000-000000000001',c,p1,'SC-2026-0177',u_requester,'Consumíveis de obra para a frente norte','normal','2026-09-10','draft',380000,'AOA',null,now()-interval '2 days',now()-interval '2 days',null,null,1),
    ('d3000000-0000-4000-8000-000000000002',c,p2,'SC-2026-0178',u_requester,'Tubagem e acessórios hidráulicos','high','2026-09-15','technical_review',920000,'AOA','technical_reviewer',now()-interval '5 days',now()-interval '4 days',now()-interval '4 days',null,2),
    ('d3000000-0000-4000-8000-000000000003',c,p3,'SC-2026-0179',u_requester,'Equipamento de proteção coletiva','high','2026-09-18','financial_review',1450000,'AOA','financial_approver',now()-interval '7 days',now()-interval '5 days',now()-interval '6 days',null,3),
    ('d3000000-0000-4000-8000-000000000004',c,p1,'SC-2026-0180',u_requester,'Sistema de cofragem para núcleo central','urgent','2026-09-05','executive_review',7850000,'AOA','executive_approver',now()-interval '10 days',now()-interval '6 days',now()-interval '9 days',null,4),
    ('d3000000-0000-4000-8000-000000000005',c,p2,'SC-2026-0181',u_requester,'Materiais elétricos para apartamentos piloto','normal','2026-09-25','approved',1850000,'AOA',null,now()-interval '12 days',now()-interval '7 days',now()-interval '11 days',now()-interval '7 days',4),
    ('d3000000-0000-4000-8000-000000000006',c,p3,'SC-2026-0182',u_requester,'Portas corta-fogo para o armazém principal','high','2026-09-20','supplier_selected',2650000,'AOA',null,now()-interval '14 days',now()-interval '5 days',now()-interval '13 days',now()-interval '9 days',6),
    ('d3000000-0000-4000-8000-000000000007',c,p2,'SC-2026-0183',u_requester,'Cerâmica e argamassas para bloco B','high','2026-09-12','ordered',3100000,'AOA',null,now()-interval '16 days',now()-interval '4 days',now()-interval '15 days',now()-interval '10 days',7),
    ('d3000000-0000-4000-8000-000000000008',c,p1,'SC-2026-0187',u_requester,'Materiais estruturais para laje do piso 7','urgent','2026-09-08','partially_received',4850000,'AOA',null,now()-interval '20 days',now()-interval '1 day',now()-interval '19 days',now()-interval '14 days',9),
    ('d3000000-0000-4000-8000-000000000009',c,p3,'SC-2026-0188',u_requester,'Iluminação industrial do cais de carga','normal','2026-08-25','received',3200000,'AOA',null,now()-interval '28 days',now()-interval '2 days',now()-interval '27 days',now()-interval '22 days',10),
    ('d3000000-0000-4000-8000-000000000010',c,p2,'SC-2026-0189',u_requester,'Louças sanitárias para bloco C','normal','2026-10-01','returned',1250000,'AOA',null,now()-interval '6 days',now()-interval '3 days',now()-interval '5 days',null,3),
    ('d3000000-0000-4000-8000-000000000011',c,p1,'SC-2026-0190',u_requester,'Aluguer de equipamento de elevação','high','2026-09-30','rejected',6100000,'AOA',null,now()-interval '11 days',now()-interval '8 days',now()-interval '10 days',null,4);

  insert into procurement.purchase_request_items(id,purchase_request_id,description,quantity,unit,estimated_unit_price,created_at) values
    ('d3100000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','Discos de corte',20,'un',19000,now()-interval '2 days'),
    ('d3100000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000002','Tubo PPR 32 mm',100,'m',9200,now()-interval '5 days'),
    ('d3100000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000003','Guarda-corpo modular',50,'m',29000,now()-interval '7 days'),
    ('d3100000-0000-4000-8000-000000000004','d3000000-0000-4000-8000-000000000004','Painel de cofragem',100,'un',78500,now()-interval '10 days'),
    ('d3100000-0000-4000-8000-000000000005','d3000000-0000-4000-8000-000000000005','Quadro elétrico',10,'un',185000,now()-interval '12 days'),
    ('d3100000-0000-4000-8000-000000000006','d3000000-0000-4000-8000-000000000006','Porta corta-fogo EI60',10,'un',265000,now()-interval '14 days'),
    ('d3100000-0000-4000-8000-000000000007','d3000000-0000-4000-8000-000000000007','Cerâmica técnica',1000,'m2',3100,now()-interval '16 days'),
    ('d3100000-0000-4000-8000-000000000081','d3000000-0000-4000-8000-000000000008','Cimento',100,'saco',21000,now()-interval '20 days'),
    ('d3100000-0000-4000-8000-000000000082','d3000000-0000-4000-8000-000000000008','Aço nervurado',50,'barra',45000,now()-interval '20 days'),
    ('d3100000-0000-4000-8000-000000000083','d3000000-0000-4000-8000-000000000008','Tinta de proteção',30,'balde',16666.67,now()-interval '20 days'),
    ('d3100000-0000-4000-8000-000000000091','d3000000-0000-4000-8000-000000000009','Projetor LED industrial',40,'un',80000,now()-interval '28 days'),
    ('d3100000-0000-4000-8000-000000000010','d3000000-0000-4000-8000-000000000010','Sanita compacta',25,'un',50000,now()-interval '6 days'),
    ('d3100000-0000-4000-8000-000000000011','d3000000-0000-4000-8000-000000000011','Plataforma elevatória',1,'mês',6100000,now()-interval '11 days');

  insert into procurement.approval_decisions(purchase_request_id,company_id,stage,decision,decided_by,comment,created_at) values
    ('d3000000-0000-4000-8000-000000000003',c,'technical','approved',u_technical,'Especificação validada.',now()-interval '6 days'),
    ('d3000000-0000-4000-8000-000000000004',c,'technical','approved',u_technical,'Conforme projeto.',now()-interval '9 days'),
    ('d3000000-0000-4000-8000-000000000004',c,'financial','approved',u_finance,'Acima do threshold executivo.',now()-interval '7 days'),
    ('d3000000-0000-4000-8000-000000000010',c,'technical','returned',u_technical,'Clarificar especificações.',now()-interval '3 days'),
    ('d3000000-0000-4000-8000-000000000011',c,'technical','approved',u_technical,null,now()-interval '10 days'),
    ('d3000000-0000-4000-8000-000000000011',c,'financial','rejected',u_finance,'Aquisição não prevista no orçamento.',now()-interval '8 days');

  insert into procurement.quotations(id,company_id,purchase_request_id,supplier_id,quotation_number,currency,subtotal,tax_amount,total,valid_until,delivery_days,payment_terms,notes,status,created_by,created_at,updated_at,version) values
    ('d4000000-0000-4000-8000-000000000061',c,'d3000000-0000-4000-8000-000000000006',s3,'CS-442/26','AOA',2520000,0,2520000,'2026-09-30',12,'30 dias',null,'accepted',u_procurement,now()-interval '8 days',now()-interval '5 days',3),
    ('d4000000-0000-4000-8000-000000000071',c,'d3000000-0000-4000-8000-000000000007',s4,'AC-993/26','AOA',3000000,0,3000000,'2026-09-30',8,'30 dias',null,'accepted',u_procurement,now()-interval '9 days',now()-interval '4 days',3),
    ('d4000000-0000-4000-8000-000000000081',c,'d3000000-0000-4000-8000-000000000008',s1,'NB-2026-418','AOA',4700000,0,4700000,'2026-09-20',5,'30 dias','Entrega faseada permitida.','accepted',u_procurement,now()-interval '12 days',now()-interval '8 days',3),
    ('d4000000-0000-4000-8000-000000000082',c,'d3000000-0000-4000-8000-000000000008',s2,'KS-2026-771','AOA',4820000,0,4820000,'2026-09-18',4,'50% adjudicação, 50% entrega',null,'submitted',u_procurement,now()-interval '12 days',now()-interval '10 days',2),
    ('d4000000-0000-4000-8000-000000000083',c,'d3000000-0000-4000-8000-000000000008',s3,'CS-459/26','AOA',4650000,0,4650000,'2026-09-16',9,'30 dias',null,'submitted',u_procurement,now()-interval '11 days',now()-interval '10 days',2),
    ('d4000000-0000-4000-8000-000000000091',c,'d3000000-0000-4000-8000-000000000009',s5,'TM-2026-228','AOA',3120000,0,3120000,'2026-08-28',3,'Pronto pagamento',null,'accepted',u_procurement,now()-interval '18 days',now()-interval '15 days',3);

  insert into procurement.quotation_items(id,quotation_id,purchase_request_item_id,description,quantity,unit,unit_price,created_at) values
    ('d4100000-0000-4000-8000-000000000061','d4000000-0000-4000-8000-000000000061','d3100000-0000-4000-8000-000000000006','Porta corta-fogo EI60',10,'un',252000,now()-interval '8 days'),
    ('d4100000-0000-4000-8000-000000000071','d4000000-0000-4000-8000-000000000071','d3100000-0000-4000-8000-000000000007','Cerâmica técnica',1000,'m2',3000,now()-interval '9 days'),
    ('d4100000-0000-4000-8000-000000000081','d4000000-0000-4000-8000-000000000081','d3100000-0000-4000-8000-000000000081','Cimento',100,'saco',20000,now()-interval '12 days'),
    ('d4100000-0000-4000-8000-000000000082','d4000000-0000-4000-8000-000000000081','d3100000-0000-4000-8000-000000000082','Aço nervurado',50,'barra',44000,now()-interval '12 days'),
    ('d4100000-0000-4000-8000-000000000083','d4000000-0000-4000-8000-000000000081','d3100000-0000-4000-8000-000000000083','Tinta de proteção',30,'balde',16666.67,now()-interval '12 days'),
    ('d4100000-0000-4000-8000-000000000084','d4000000-0000-4000-8000-000000000082','d3100000-0000-4000-8000-000000000081','Cimento',100,'saco',20500,now()-interval '12 days'),
    ('d4100000-0000-4000-8000-000000000085','d4000000-0000-4000-8000-000000000082','d3100000-0000-4000-8000-000000000082','Aço nervurado',50,'barra',45400,now()-interval '12 days'),
    ('d4100000-0000-4000-8000-000000000086','d4000000-0000-4000-8000-000000000082','d3100000-0000-4000-8000-000000000083','Tinta de proteção',30,'balde',16666.67,now()-interval '12 days'),
    ('d4100000-0000-4000-8000-000000000087','d4000000-0000-4000-8000-000000000083','d3100000-0000-4000-8000-000000000081','Cimento',100,'saco',19500,now()-interval '11 days'),
    ('d4100000-0000-4000-8000-000000000088','d4000000-0000-4000-8000-000000000083','d3100000-0000-4000-8000-000000000082','Aço nervurado',50,'barra',44000,now()-interval '11 days'),
    ('d4100000-0000-4000-8000-000000000089','d4000000-0000-4000-8000-000000000083','d3100000-0000-4000-8000-000000000083','Tinta de proteção',30,'balde',16666.67,now()-interval '11 days'),
    ('d4100000-0000-4000-8000-000000000091','d4000000-0000-4000-8000-000000000091','d3100000-0000-4000-8000-000000000091','Projetor LED industrial',40,'un',78000,now()-interval '18 days');

  insert into procurement.supplier_selections(id,company_id,purchase_request_id,quotation_id,supplier_id,selected_by,justification,selected_at) values
    ('d7000000-0000-4000-8000-000000000006',c,'d3000000-0000-4000-8000-000000000006','d4000000-0000-4000-8000-000000000061',s3,u_procurement,'Conformidade técnica e disponibilidade confirmadas.',now()-interval '5 days'),
    ('d7000000-0000-4000-8000-000000000007',c,'d3000000-0000-4000-8000-000000000007','d4000000-0000-4000-8000-000000000071',s4,u_procurement,'Melhor prazo com cobertura integral.',now()-interval '4 days'),
    ('d7000000-0000-4000-8000-000000000008',c,'d3000000-0000-4000-8000-000000000008','d4000000-0000-4000-8000-000000000081',s1,u_procurement,'Melhor equilíbrio entre preço, prazo e condições de entrega.',now()-interval '8 days'),
    ('d7000000-0000-4000-8000-000000000009',c,'d3000000-0000-4000-8000-000000000009','d4000000-0000-4000-8000-000000000091',s5,u_procurement,'Disponibilidade imediata e menor custo total.',now()-interval '15 days');

  insert into procurement.purchase_orders(id,company_id,purchase_request_id,supplier_id,quotation_id,order_number,currency,subtotal,tax_amount,total,status,issued_by,issued_at,created_at,updated_at,version) values
    ('d5000000-0000-4000-8000-000000000007',c,'d3000000-0000-4000-8000-000000000007',s4,'d4000000-0000-4000-8000-000000000071','PO-2026-000041','AOA',3000000,0,3000000,'issued',u_procurement,now()-interval '4 days',now()-interval '4 days',now()-interval '4 days',1),
    ('d5000000-0000-4000-8000-000000000008',c,'d3000000-0000-4000-8000-000000000008',s1,'d4000000-0000-4000-8000-000000000081','PO-2026-000042','AOA',4700000,0,4700000,'partially_received',u_procurement,now()-interval '7 days',now()-interval '7 days',now()-interval '1 day',2),
    ('d5000000-0000-4000-8000-000000000009',c,'d3000000-0000-4000-8000-000000000009',s5,'d4000000-0000-4000-8000-000000000091','PO-2026-000043','AOA',3120000,0,3120000,'received',u_procurement,now()-interval '14 days',now()-interval '14 days',now()-interval '2 days',3);

  insert into procurement.purchase_order_items(id,purchase_order_id,purchase_request_item_id,description,quantity,unit,unit_price,created_at) values
    ('d5100000-0000-4000-8000-000000000071','d5000000-0000-4000-8000-000000000007','d3100000-0000-4000-8000-000000000007','Cerâmica técnica',1000,'m2',3000,now()-interval '4 days'),
    ('d5100000-0000-4000-8000-000000000081','d5000000-0000-4000-8000-000000000008','d3100000-0000-4000-8000-000000000081','Cimento',100,'saco',20000,now()-interval '7 days'),
    ('d5100000-0000-4000-8000-000000000082','d5000000-0000-4000-8000-000000000008','d3100000-0000-4000-8000-000000000082','Aço nervurado',50,'barra',44000,now()-interval '7 days'),
    ('d5100000-0000-4000-8000-000000000083','d5000000-0000-4000-8000-000000000008','d3100000-0000-4000-8000-000000000083','Tinta de proteção',30,'balde',16666.67,now()-interval '7 days'),
    ('d5100000-0000-4000-8000-000000000091','d5000000-0000-4000-8000-000000000009','d3100000-0000-4000-8000-000000000091','Projetor LED industrial',40,'un',78000,now()-interval '14 days');

  insert into procurement.goods_receipts(id,company_id,purchase_order_id,receipt_number,received_by,received_at,notes,status,created_at) values
    ('d6000000-0000-4000-8000-000000000081',c,'d5000000-0000-4000-8000-000000000008','GR-2026-000087',u_warehouse,now()-interval '1 day','Entrega parcial conforme guia 8871.','partial',now()-interval '1 day'),
    ('d6000000-0000-4000-8000-000000000091',c,'d5000000-0000-4000-8000-000000000009','GR-2026-000088',u_warehouse,now()-interval '4 days','Primeira entrega.','partial',now()-interval '4 days'),
    ('d6000000-0000-4000-8000-000000000092',c,'d5000000-0000-4000-8000-000000000009','GR-2026-000089',u_warehouse,now()-interval '2 days','Entrega final validada.','complete',now()-interval '2 days');
  insert into procurement.goods_receipt_items(goods_receipt_id,purchase_order_item_id,quantity_received,created_at) values
    ('d6000000-0000-4000-8000-000000000081','d5100000-0000-4000-8000-000000000081',80,now()-interval '1 day'),
    ('d6000000-0000-4000-8000-000000000081','d5100000-0000-4000-8000-000000000082',50,now()-interval '1 day'),
    ('d6000000-0000-4000-8000-000000000081','d5100000-0000-4000-8000-000000000083',10,now()-interval '1 day'),
    ('d6000000-0000-4000-8000-000000000091','d5100000-0000-4000-8000-000000000091',20,now()-interval '4 days'),
    ('d6000000-0000-4000-8000-000000000092','d5100000-0000-4000-8000-000000000091',20,now()-interval '2 days');

  insert into platform.procurement_document_sequences(company_id,document_type,document_year,last_value) values
    (c,'PO',2026,43),(c,'GR',2026,89);

  -- Coherent audit histories used in the demo and notification inbox.
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata,created_at) values
    (c,u_requester,'PurchaseRequestCreated','procurement','purchase_request','d3000000-0000-4000-8000-000000000008','{"request_number":"SC-2026-0187"}',now()-interval '20 days'),
    (c,u_requester,'PurchaseRequestSubmitted','procurement','purchase_request','d3000000-0000-4000-8000-000000000008','{"to_status":"technical_review"}',now()-interval '19 days'),
    (c,u_technical,'TechnicalApprovalGranted','procurement','purchase_request','d3000000-0000-4000-8000-000000000008','{"to_status":"financial_review"}',now()-interval '17 days'),
    (c,u_finance,'FinancialApprovalGranted','procurement','purchase_request','d3000000-0000-4000-8000-000000000008','{"to_status":"approved"}',now()-interval '14 days'),
    (c,u_procurement,'SupplierSelected','procurement','purchase_request','d3000000-0000-4000-8000-000000000008',jsonb_build_object('quotation_id','d4000000-0000-4000-8000-000000000081','supplier_id',s1),now()-interval '8 days'),
    (c,u_procurement,'PurchaseOrderIssued','procurement','purchase_order','d5000000-0000-4000-8000-000000000008',jsonb_build_object('purchaseRequestId','d3000000-0000-4000-8000-000000000008','orderNumber','PO-2026-000042'),now()-interval '7 days'),
    (c,u_warehouse,'GoodsReceiptRecorded','procurement','goods_receipt','d6000000-0000-4000-8000-000000000081',jsonb_build_object('purchaseOrderId','d5000000-0000-4000-8000-000000000008','status','partial'),now()-interval '1 day'),
    (c,u_warehouse,'PurchaseOrderPartiallyReceived','procurement','purchase_order','d5000000-0000-4000-8000-000000000008',jsonb_build_object('receiptId','d6000000-0000-4000-8000-000000000081'),now()-interval '1 day'),
    (c,u_warehouse,'PurchaseRequestPartiallyReceived','procurement','purchase_request','d3000000-0000-4000-8000-000000000008',jsonb_build_object('purchaseOrderId','d5000000-0000-4000-8000-000000000008'),now()-interval '1 day'),
    (c,u_requester,'PurchaseRequestCreated','procurement','purchase_request','d3000000-0000-4000-8000-000000000009','{"request_number":"SC-2026-0188"}',now()-interval '28 days'),
    (c,u_requester,'PurchaseRequestSubmitted','procurement','purchase_request','d3000000-0000-4000-8000-000000000009','{"to_status":"technical_review"}',now()-interval '27 days'),
    (c,u_technical,'TechnicalApprovalGranted','procurement','purchase_request','d3000000-0000-4000-8000-000000000009','{"to_status":"financial_review"}',now()-interval '25 days'),
    (c,u_finance,'FinancialApprovalGranted','procurement','purchase_request','d3000000-0000-4000-8000-000000000009','{"to_status":"approved"}',now()-interval '22 days'),
    (c,u_procurement,'SupplierSelected','procurement','purchase_request','d3000000-0000-4000-8000-000000000009',jsonb_build_object('quotation_id','d4000000-0000-4000-8000-000000000091','supplier_id',s5),now()-interval '15 days'),
    (c,u_procurement,'PurchaseOrderIssued','procurement','purchase_order','d5000000-0000-4000-8000-000000000009',jsonb_build_object('purchaseRequestId','d3000000-0000-4000-8000-000000000009','orderNumber','PO-2026-000043'),now()-interval '14 days'),
    (c,u_warehouse,'GoodsReceiptRecorded','procurement','goods_receipt','d6000000-0000-4000-8000-000000000091',jsonb_build_object('purchaseOrderId','d5000000-0000-4000-8000-000000000009','status','partial'),now()-interval '4 days'),
    (c,u_warehouse,'PurchaseOrderPartiallyReceived','procurement','purchase_order','d5000000-0000-4000-8000-000000000009',jsonb_build_object('receiptId','d6000000-0000-4000-8000-000000000091'),now()-interval '4 days'),
    (c,u_warehouse,'GoodsReceiptRecorded','procurement','goods_receipt','d6000000-0000-4000-8000-000000000092',jsonb_build_object('purchaseOrderId','d5000000-0000-4000-8000-000000000009','status','complete'),now()-interval '2 days'),
    (c,u_warehouse,'PurchaseOrderReceived','procurement','purchase_order','d5000000-0000-4000-8000-000000000009',jsonb_build_object('receiptId','d6000000-0000-4000-8000-000000000092'),now()-interval '2 days'),
    (c,u_warehouse,'PurchaseRequestReceived','procurement','purchase_request','d3000000-0000-4000-8000-000000000009',jsonb_build_object('purchaseOrderId','d5000000-0000-4000-8000-000000000009'),now()-interval '2 days'),
    (c,u_requester,'PurchaseRequestReturned','procurement','purchase_request','d3000000-0000-4000-8000-000000000010','{"stage":"technical"}',now()-interval '3 days'),
    (c,u_requester,'PurchaseRequestRejected','procurement','purchase_request','d3000000-0000-4000-8000-000000000011','{"stage":"financial"}',now()-interval '8 days');
end;
$$;
revoke all on function platform.seed_atlas_demo_data() from public,anon,authenticated;
grant execute on function platform.seed_atlas_demo_data() to service_role;
grant usage on schema platform to service_role;
create or replace function public.seed_atlas_demo_data()
returns void language sql security invoker set search_path='' as $$select platform.seed_atlas_demo_data();$$;
revoke all on function public.seed_atlas_demo_data() from public,anon,authenticated;
grant execute on function public.seed_atlas_demo_data() to service_role;

create or replace function platform.seed_atlas_demo_document(
  p_resource_type text,p_resource_id uuid,p_storage_path text,p_original_name text,p_mime_type text,p_size_bytes bigint,p_uploader_email text
)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_ctx record;v_user uuid;v_id uuid:=gen_random_uuid();begin
  select * into v_ctx from platform.document_resource_context(p_resource_type,p_resource_id);
  if v_ctx.company_id is distinct from 'd0000000-0000-4000-8000-000000000001'::uuid then raise exception using errcode='42501',message='demo_resource_required'; end if;
  select id into v_user from auth.users where email=p_uploader_email;
  if v_user is null then raise exception using errcode='P0001',message='demo_uploader_not_found'; end if;
  insert into documents.files(id,company_id,project_id,resource_type,resource_id,storage_path,original_name,mime_type,size_bytes,uploaded_by,status)
  values(v_id,v_ctx.company_id,v_ctx.project_id,p_resource_type,p_resource_id,p_storage_path,p_original_name,p_mime_type,p_size_bytes,v_user,'ready')
  on conflict(storage_path) do update set resource_type=excluded.resource_type,resource_id=excluded.resource_id,original_name=excluded.original_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,status='ready'
  returning id into v_id;
  return v_id;
end;$$;
revoke all on function platform.seed_atlas_demo_document(text,uuid,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function platform.seed_atlas_demo_document(text,uuid,text,text,text,bigint,text) to service_role;
create or replace function public.seed_atlas_demo_document(resource_type text,resource_id uuid,storage_path text,original_name text,mime_type text,size_bytes bigint,uploader_email text)
returns uuid language sql security invoker set search_path='' as $$select platform.seed_atlas_demo_document($1,$2,$3,$4,$5,$6,$7);$$;
revoke all on function public.seed_atlas_demo_document(text,uuid,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.seed_atlas_demo_document(text,uuid,text,text,text,bigint,text) to service_role;

create or replace function platform.list_purchase_request_audit(p_purchase_request_id uuid)
returns table(action text,user_id uuid,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_company_id uuid;
begin
  perform platform.require_procurement_permission('Procurement.View');
  v_company_id:=platform.current_company_id();
  if not exists(
    select 1 from procurement.purchase_requests request
    where request.id=p_purchase_request_id and request.company_id=v_company_id
  ) then
    raise exception using errcode='P0001',message='purchase_request_not_found';
  end if;
  return query
  select entry.action,entry.user_id,entry.metadata,entry.created_at
  from audit.entries entry
  where entry.company_id=v_company_id
    and entry.module='procurement'
    and (
      (entry.resource_type='purchase_request' and entry.resource_id=p_purchase_request_id)
      or (entry.resource_type='purchase_order' and exists(
        select 1 from procurement.purchase_orders purchase_order
        where purchase_order.id=entry.resource_id
          and purchase_order.purchase_request_id=p_purchase_request_id
          and purchase_order.company_id=v_company_id
      ))
      or (entry.resource_type='goods_receipt' and exists(
        select 1
        from procurement.goods_receipts receipt
        join procurement.purchase_orders purchase_order
          on purchase_order.id=receipt.purchase_order_id
         and purchase_order.company_id=receipt.company_id
        where receipt.id=entry.resource_id
          and purchase_order.purchase_request_id=p_purchase_request_id
          and receipt.company_id=v_company_id
      ))
    )
  order by entry.created_at,entry.id;
end;
$$;
