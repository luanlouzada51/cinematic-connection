/**
 * Tipos do banco.
 *
 * Escritos à mão a partir de `supabase/migrations`, no formato que o
 * supabase-js espera. Ao mexer no schema, atualize os dois lados juntos.
 */

export type AccountRole = "owner" | "worker" | "customer";
export type MemberRole = "owner" | "manager" | "cleaner";
export type Recurrence =
  "one_time" | "weekly" | "biweekly" | "every_3_weeks" | "every_4_weeks" | "monthly";
export type ServiceType =
  "standard" | "deep_clean" | "move_in_out" | "post_construction" | "office";
export type AppointmentStatus =
  "scheduled" | "on_my_way" | "in_progress" | "completed" | "canceled";
export type AppointmentEventKind =
  "on_my_way" | "clock_in" | "clock_out" | "completed" | "canceled";
export type PaymentCollector = "unpaid" | "company" | "worker";
export type PayModel = "percentage" | "daily" | "hourly";
export type CleaningSkill =
  | "dusting"
  | "kitchen"
  | "bathroom"
  | "mopping"
  | "vacuum"
  | "windows"
  | "laundry"
  | "ironing"
  | "organizing"
  | "deep_clean"
  | "move_out"
  | "office";
export type AvailabilityPeriod = "morning" | "afternoon" | "full_day" | "night";
export type GigStatus = "open" | "filled" | "in_progress" | "completed" | "canceled";
export type GigWorkerStatus = "hired" | "in_progress" | "completed" | "no_show" | "canceled";
export type ApplicationStatus = "pending" | "accepted" | "declined" | "withdrawn";
export type ThreadKind = "customer" | "gig";
export type ReviewSubject = "company" | "worker";
export type PayoutStatus = "open" | "closed" | "settled";

/** Campos obrigatórios no insert; o resto tem default no banco. */
type TableDef<Row extends object, RequiredOnInsert extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, RequiredOnInsert> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Account = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  locale: string;
  primary_role: AccountRole;
  onboarding_done: boolean;
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  default_pay_model: PayModel;
  default_worker_percentage: number;
  default_daily_rate: number | null;
  default_hourly_rate: number | null;
  show_prices_to_workers: boolean;
  show_prices_to_customers: boolean;
  allow_customer_chat: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyMember = {
  id: string;
  company_id: string;
  account_id: string | null;
  invite_email: string | null;
  invite_code: string | null;
  display_name: string;
  role: MemberRole;
  pay_model: PayModel | null;
  worker_percentage: number | null;
  daily_rate: number | null;
  hourly_rate: number | null;
  active: boolean;
  created_at: string;
};

export type Customer = {
  id: string;
  company_id: string;
  account_id: string | null;
  portal_code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  customer_id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  access_notes: string | null;
  parking_notes: string | null;
  created_at: string;
};

export type ServiceSeries = {
  id: string;
  company_id: string;
  customer_id: string;
  property_id: string;
  service_type: ServiceType;
  recurrence: Recurrence;
  start_date: string;
  start_time: string;
  duration_minutes: number;
  price: number;
  notes: string | null;
  active: boolean;
  created_at: string;
};

export type Appointment = {
  id: string;
  company_id: string;
  customer_id: string;
  property_id: string;
  series_id: string | null;
  service_type: ServiceType;
  scheduled_date: string;
  start_time: string;
  end_time: string | null;
  price: number;
  status: AppointmentStatus;
  payment_collector: PaymentCollector;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentAssignment = {
  id: string;
  appointment_id: string;
  member_id: string;
  created_at: string;
};

export type AppointmentEvent = {
  id: string;
  appointment_id: string;
  account_id: string | null;
  kind: AppointmentEventKind;
  note: string | null;
  created_at: string;
};

export type AppointmentPhoto = {
  id: string;
  appointment_id: string;
  account_id: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
};

export type Thread = {
  id: string;
  kind: ThreadKind;
  company_id: string;
  customer_id: string | null;
  gig_id: string | null;
  worker_id: string | null;
  last_message_at: string | null;
  created_at: string;
};

export type ThreadMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type WorkerProfile = {
  account_id: string;
  headline: string | null;
  bio: string | null;
  skills: CleaningSkill[];
  years_experience: number | null;
  has_car: boolean;
  radius_km: number;
  daily_rate: number | null;
  hourly_rate: number | null;
  accepts_percentage: boolean;
  min_percentage: number | null;
  visible: boolean;
  rating_avg: number;
  rating_count: number;
  jobs_done: number;
  created_at: string;
  updated_at: string;
};

export type WorkerAvailability = {
  id: string;
  account_id: string;
  date: string;
  period: AvailabilityPeriod;
  note: string | null;
  created_at: string;
};

export type Gig = {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string | null;
  date: string;
  start_time: string;
  end_time: string | null;
  required_skills: CleaningSkill[];
  headcount: number;
  pay_model: PayModel;
  daily_rate: number | null;
  hourly_rate: number | null;
  worker_percentage: number | null;
  status: GigStatus;
  created_at: string;
  updated_at: string;
};

export type GigApplication = {
  id: string;
  gig_id: string;
  worker_id: string;
  message: string | null;
  status: ApplicationStatus;
  created_at: string;
};

export type GigWorker = {
  id: string;
  gig_id: string;
  worker_id: string;
  status: GigWorkerStatus;
  started_at: string | null;
  ended_at: string | null;
  agreed_pay_model: PayModel;
  agreed_daily_rate: number | null;
  agreed_hourly_rate: number | null;
  agreed_percentage: number | null;
  /** Valor das casas feitas neste trabalho — base da porcentagem combinada. */
  house_revenue: number;
  collected_by: PaymentCollector;
  created_at: string;
};

export type WorkReview = {
  id: string;
  gig_id: string;
  author_id: string;
  subject_kind: ReviewSubject;
  subject_account_id: string | null;
  subject_company_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type PayoutPeriod = {
  id: string;
  company_id: string;
  /** Acerto de alguém da equipe... */
  member_id: string | null;
  /** ...ou de alguém contratado pelo mercado. Sempre exatamente um dos dois. */
  worker_account_id: string | null;
  start_date: string;
  end_date: string;
  pay_model: PayModel;
  worker_percentage: number | null;
  daily_rate: number | null;
  hourly_rate: number | null;
  status: PayoutStatus;
  settled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PayoutAdjustment = {
  id: string;
  period_id: string;
  label: string;
  amount: number;
  created_at: string;
};

export type PayoutLine = {
  id: string;
  period_id: string;
  appointment_id: string | null;
  gig_id: string | null;
  label: string;
  service_date: string;
  gross: number;
  collector: PaymentCollector;
  worker_share: number;
  company_share: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      accounts: TableDef<Account, "id">;
      companies: TableDef<Company, "owner_id" | "name">;
      company_members: TableDef<CompanyMember, "company_id" | "display_name">;
      customers: TableDef<Customer, "company_id" | "name">;
      properties: TableDef<Property, "customer_id" | "address_line1">;
      service_series: TableDef<
        ServiceSeries,
        "company_id" | "customer_id" | "property_id" | "start_date"
      >;
      appointments: TableDef<
        Appointment,
        "company_id" | "customer_id" | "property_id" | "scheduled_date"
      >;
      appointment_assignments: TableDef<AppointmentAssignment, "appointment_id" | "member_id">;
      appointment_events: TableDef<AppointmentEvent, "appointment_id" | "kind">;
      appointment_photos: TableDef<AppointmentPhoto, "appointment_id" | "storage_path">;
      threads: TableDef<Thread, "kind" | "company_id">;
      thread_messages: TableDef<ThreadMessage, "thread_id" | "sender_id" | "body">;
      worker_profiles: TableDef<WorkerProfile, "account_id">;
      worker_availability: TableDef<WorkerAvailability, "account_id" | "date">;
      gigs: TableDef<Gig, "company_id" | "created_by" | "title" | "date">;
      gig_applications: TableDef<GigApplication, "gig_id" | "worker_id">;
      gig_workers: TableDef<GigWorker, "gig_id" | "worker_id">;
      work_reviews: TableDef<WorkReview, "gig_id" | "author_id" | "subject_kind" | "rating">;
      payout_periods: TableDef<PayoutPeriod, "company_id" | "start_date" | "end_date">;
      payout_adjustments: TableDef<PayoutAdjustment, "period_id" | "label" | "amount">;
      payout_lines: TableDef<PayoutLine, "period_id" | "label" | "service_date">;
    };
    Views: Record<never, never>;
    Functions: {
      claim_team_invite: { Args: { _code: string }; Returns: string | null };
      claim_customer_portal: { Args: { _code: string }; Returns: string | null };
    };
    Enums: {
      account_role: AccountRole;
      member_role: MemberRole;
      recurrence: Recurrence;
      service_type: ServiceType;
      appointment_status: AppointmentStatus;
      appointment_event_kind: AppointmentEventKind;
      payment_collector: PaymentCollector;
      pay_model: PayModel;
      cleaning_skill: CleaningSkill;
      availability_period: AvailabilityPeriod;
      gig_status: GigStatus;
      gig_worker_status: GigWorkerStatus;
      application_status: ApplicationStatus;
      thread_kind: ThreadKind;
      review_subject: ReviewSubject;
      payout_status: PayoutStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};
