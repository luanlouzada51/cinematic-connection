import { describe, expect, it } from "vitest";

import { settlePeriod, type SettlementJob } from "@/features/payouts/settlement";

function job(
  price: number,
  collector: SettlementJob["collector"],
  date = "2026-08-24",
): SettlementJob {
  return { id: `${date}-${price}-${collector}`, label: "Casa", date, price, collector };
}

describe("settlePeriod", () => {
  it("divide 80/20 e cobra do profissional o que ele recebeu a mais", () => {
    // Semana de 3.000 recebida inteira na mão do profissional.
    const result = settlePeriod({
      model: "percentage",
      workerPercentage: 80,
      jobs: [
        job(1000, "worker", "2026-08-24"),
        job(1000, "worker", "2026-08-25"),
        job(1000, "worker", "2026-08-26"),
      ],
    });

    expect(result.gross).toBe(3000);
    expect(result.workerDue).toBe(2400);
    expect(result.companyDue).toBe(600);
    expect(result.balance).toBe(-600);
    expect(result.direction).toBe("worker_pays_company");
  });

  it("cobra da empresa quando ela recebeu tudo", () => {
    const result = settlePeriod({
      model: "percentage",
      workerPercentage: 80,
      jobs: [job(1500, "company", "2026-08-24"), job(1500, "company", "2026-08-25")],
    });

    expect(result.workerDue).toBe(2400);
    expect(result.balance).toBe(2400);
    expect(result.direction).toBe("company_pays_worker");
  });

  it("fecha zerado quando cada lado já ficou com a sua parte", () => {
    const result = settlePeriod({
      model: "percentage",
      workerPercentage: 80,
      jobs: [job(2400, "worker", "2026-08-24"), job(600, "company", "2026-08-25")],
    });

    expect(result.balance).toBe(0);
    expect(result.direction).toBe("balanced");
  });

  it("deixa a casa não paga fora da divisão por padrão", () => {
    const result = settlePeriod({
      model: "percentage",
      workerPercentage: 80,
      jobs: [job(1000, "worker", "2026-08-24"), job(500, "unpaid", "2026-08-25")],
    });

    expect(result.gross).toBe(1500);
    expect(result.unpaid).toBe(500);
    expect(result.splitBase).toBe(1000);
    expect(result.workerDue).toBe(800);
    expect(result.balance).toBe(-200);
  });

  it("considera a casa não paga quando a empresa pede", () => {
    const result = settlePeriod({
      model: "percentage",
      workerPercentage: 80,
      includeUnpaidInSplit: true,
      jobs: [job(1000, "worker", "2026-08-24"), job(500, "unpaid", "2026-08-25")],
    });

    expect(result.splitBase).toBe(1500);
    expect(result.workerDue).toBe(1200);
  });

  it("aplica desconto e bônus depois da divisão", () => {
    const result = settlePeriod({
      model: "percentage",
      workerPercentage: 80,
      jobs: [job(1000, "company", "2026-08-24")],
      adjustments: [
        { label: "Material", amount: -50 },
        { label: "Gorjeta", amount: 30 },
      ],
    });

    expect(result.workerBase).toBe(800);
    expect(result.adjustmentsTotal).toBe(-20);
    expect(result.workerDue).toBe(780);
    expect(result.companyDue).toBe(220);
    expect(result.balance).toBe(780);
  });

  it("paga diária por dia com serviço, não por casa", () => {
    const result = settlePeriod({
      model: "daily",
      dailyRate: 150,
      jobs: [
        job(200, "company", "2026-08-24"),
        job(180, "company", "2026-08-24"),
        job(220, "company", "2026-08-25"),
      ],
    });

    expect(result.daysWorked).toBe(2);
    expect(result.workerDue).toBe(300);
    expect(result.companyDue).toBe(300);
    expect(result.direction).toBe("company_pays_worker");
  });

  it("paga por hora quando o modelo é hora", () => {
    const result = settlePeriod({
      model: "hourly",
      hourlyRate: 25,
      hoursWorked: 18.5,
      jobs: [job(600, "company", "2026-08-24")],
    });

    expect(result.workerDue).toBe(462.5);
    expect(result.companyDue).toBe(137.5);
  });

  it("arredonda centavos em vez de arrastar dízima", () => {
    const result = settlePeriod({
      model: "percentage",
      workerPercentage: 33.33,
      jobs: [job(100.1, "company", "2026-08-24")],
    });

    expect(result.workerDue).toBe(33.36);
    expect(result.companyDue).toBe(66.74);
  });

  it("não quebra com período sem nenhuma casa", () => {
    const result = settlePeriod({ model: "percentage", workerPercentage: 80, jobs: [] });

    expect(result.gross).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.direction).toBe("balanced");
  });
});
