import type { PayModel, PaymentCollector } from "@/integrations/supabase/types";

/**
 * Acerto de contas do período.
 *
 * A pergunta que este módulo responde é sempre a mesma: no fim da semana (ou do
 * dia, ou do intervalo que a empresa escolher), quanto cada lado deveria ficar,
 * quanto cada lado já pegou em mãos, e quem precisa passar dinheiro para quem
 * para que a divisão combinada — 80/20, diária, hora — fique de pé.
 */

export type SettlementJob = {
  id: string;
  label: string;
  date: string;
  price: number;
  collector: PaymentCollector;
};

/**
 * Um trabalho pego no mercado. Diferente das casas da agenda, cada vaga carrega
 * as próprias condições — foi o que as duas partes combinaram ali.
 */
export type SettlementGig = {
  id: string;
  label: string;
  date: string;
  model: PayModel;
  dailyRate?: number | null;
  hourlyRate?: number | null;
  percentage?: number | null;
  /** Horas do trabalho, usadas quando o combinado foi por hora. */
  hours?: number;
  /** Valor das casas feitas na vaga — base da porcentagem combinada. */
  revenue: number;
  collector: PaymentCollector;
};

export type SettlementAdjustment = {
  label: string;
  /** Positivo soma ao que o profissional recebe; negativo desconta. */
  amount: number;
};

export type SettlementInput = {
  model: PayModel;
  /** Fatia do profissional no modelo de porcentagem (0 a 100). */
  workerPercentage?: number | null;
  dailyRate?: number | null;
  hourlyRate?: number | null;
  hoursWorked?: number;
  jobs: SettlementJob[];
  /** Trabalhos pegos no mercado dentro do mesmo período. */
  gigs?: SettlementGig[];
  adjustments?: SettlementAdjustment[];
  /**
   * Casa concluída mas ainda não paga pelo cliente. Por padrão fica fora da
   * divisão: ninguém recebeu esse dinheiro ainda, então cobrar dele criaria uma
   * dívida de valor que não existe. Ligando, a divisão passa a considerar o
   * total cheio das casas.
   */
  includeUnpaidInSplit?: boolean;
};

export type Settlement = {
  /** Casas da agenda mais o que as vagas renderam, pago ou não. */
  gross: number;
  /** Parte do total que veio de vagas do mercado. */
  gigsRevenue: number;
  collectedByWorker: number;
  collectedByCompany: number;
  unpaid: number;
  /** Base usada na divisão (por padrão, só o que já entrou). */
  splitBase: number;
  daysWorked: number;
  /** Base do profissional somando casas e vagas, antes de descontos e bônus. */
  workerBase: number;
  /** Quanto dessa base veio das vagas do mercado. */
  gigsBase: number;
  adjustmentsTotal: number;
  /** Quanto o profissional deve ficar, já com descontos e bônus. */
  workerDue: number;
  /** Quanto a empresa deve ficar do dinheiro já recebido. */
  companyDue: number;
  /**
   * Positivo: a empresa ainda deve esse valor ao profissional.
   * Negativo: o profissional recebeu demais e repassa esse valor à empresa.
   */
  balance: number;
  direction: "company_pays_worker" | "worker_pays_company" | "balanced";
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

/** Dias distintos com pelo menos uma casa — é o que a diária cobra. */
export function countWorkedDays(jobs: SettlementJob[]): number {
  return new Set(jobs.map((job) => job.date)).size;
}

/** Quanto um trabalho do mercado rende para o profissional. */
export function gigEarning(gig: SettlementGig): number {
  switch (gig.model) {
    case "percentage":
      return (gig.revenue * (gig.percentage ?? 0)) / 100;
    case "daily":
      return gig.dailyRate ?? 0;
    case "hourly":
      return (gig.hourlyRate ?? 0) * (gig.hours ?? 0);
  }
}

export function settlePeriod(input: SettlementInput): Settlement {
  const { jobs, gigs = [], adjustments = [], includeUnpaidInSplit = false } = input;

  const collectedBy = (collector: PaymentCollector) =>
    round2(
      sumBy(
        jobs.filter((job) => job.collector === collector),
        (job) => job.price,
      ) +
        sumBy(
          gigs.filter((gig) => gig.collector === collector),
          (gig) => gig.revenue,
        ),
    );

  const housesGross = round2(sumBy(jobs, (job) => job.price));
  const gigsRevenue = round2(sumBy(gigs, (gig) => gig.revenue));
  const gross = round2(housesGross + gigsRevenue);

  const collectedByWorker = collectedBy("worker");
  const collectedByCompany = collectedBy("company");
  const unpaid = round2(gross - collectedByWorker - collectedByCompany);

  // A divisão das casas da agenda usa só o dinheiro das casas; cada vaga do
  // mercado tem as próprias condições, combinadas na hora da contratação.
  const housesCollected = round2(
    sumBy(
      jobs.filter((job) => job.collector !== "unpaid"),
      (job) => job.price,
    ),
  );
  const splitBase = includeUnpaidInSplit ? housesGross : housesCollected;
  const daysWorked = countWorkedDays(jobs);

  const housesBase = round2(computeWorkerBase(input, splitBase, daysWorked));
  const gigsBase = round2(sumBy(gigs, gigEarning));
  const workerBase = round2(housesBase + gigsBase);
  const adjustmentsTotal = round2(sumBy(adjustments, (item) => item.amount));
  const workerDue = round2(workerBase + adjustmentsTotal);

  // O bolo a dividir é o que existe: o dinheiro já recebido, ou o total das
  // casas quando a empresa opta por contar o que ainda não entrou.
  const pot = includeUnpaidInSplit ? gross : round2(collectedByWorker + collectedByCompany);
  const companyDue = round2(pot - workerDue);

  // O profissional já está com `collectedByWorker`. A diferença para o que ele
  // deveria ficar é exatamente o repasse que fecha o período.
  const balance = round2(workerDue - collectedByWorker);

  return {
    gross,
    gigsRevenue,
    collectedByWorker,
    collectedByCompany,
    unpaid,
    splitBase,
    daysWorked,
    workerBase,
    gigsBase,
    adjustmentsTotal,
    workerDue,
    companyDue,
    balance,
    direction:
      balance > 0 ? "company_pays_worker" : balance < 0 ? "worker_pays_company" : "balanced",
  };
}

function computeWorkerBase(input: SettlementInput, splitBase: number, daysWorked: number): number {
  switch (input.model) {
    case "percentage":
      return (splitBase * (input.workerPercentage ?? 0)) / 100;
    case "daily":
      return (input.dailyRate ?? 0) * daysWorked;
    case "hourly":
      return (input.hourlyRate ?? 0) * (input.hoursWorked ?? 0);
  }
}
