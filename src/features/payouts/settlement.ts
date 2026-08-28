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
  /** Soma de todas as casas do período, pagas ou não. */
  gross: number;
  collectedByWorker: number;
  collectedByCompany: number;
  unpaid: number;
  /** Base usada na divisão (por padrão, só o que já entrou). */
  splitBase: number;
  daysWorked: number;
  workerBase: number;
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

export function settlePeriod(input: SettlementInput): Settlement {
  const { jobs, adjustments = [], includeUnpaidInSplit = false } = input;

  const gross = round2(sumBy(jobs, (job) => job.price));
  const collectedByWorker = round2(
    sumBy(
      jobs.filter((job) => job.collector === "worker"),
      (job) => job.price,
    ),
  );
  const collectedByCompany = round2(
    sumBy(
      jobs.filter((job) => job.collector === "company"),
      (job) => job.price,
    ),
  );
  const unpaid = round2(gross - collectedByWorker - collectedByCompany);
  const splitBase = includeUnpaidInSplit ? gross : round2(collectedByWorker + collectedByCompany);
  const daysWorked = countWorkedDays(jobs);

  const workerBase = round2(computeWorkerBase(input, splitBase, daysWorked));
  const adjustmentsTotal = round2(sumBy(adjustments, (item) => item.amount));
  const workerDue = round2(workerBase + adjustmentsTotal);
  const companyDue = round2(splitBase - workerDue);

  // O profissional já está com `collectedByWorker`. A diferença para o que ele
  // deveria ficar é exatamente o repasse que fecha o período.
  const balance = round2(workerDue - collectedByWorker);

  return {
    gross,
    collectedByWorker,
    collectedByCompany,
    unpaid,
    splitBase,
    daysWorked,
    workerBase,
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
