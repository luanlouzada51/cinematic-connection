import { describe, expect, it } from "vitest";

import { nextOccurrenceDates, occurrenceDates } from "@/features/schedule/recurrence";

describe("occurrenceDates", () => {
  it("gera uma única data para serviço avulso", () => {
    expect(occurrenceDates("2026-08-27", "one_time", 5)).toEqual(["2026-08-27"]);
  });

  it("gera a cadência quinzenal a partir da primeira data", () => {
    expect(occurrenceDates("2026-08-27", "biweekly", 3)).toEqual([
      "2026-08-27",
      "2026-09-10",
      "2026-09-24",
    ]);
  });

  it("mantém o dia do mês na recorrência mensal", () => {
    expect(occurrenceDates("2026-01-31", "monthly", 3)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("atravessa a virada do ano sem escorregar", () => {
    expect(occurrenceDates("2026-12-28", "weekly", 3)).toEqual([
      "2026-12-28",
      "2027-01-04",
      "2027-01-11",
    ]);
  });
});

describe("nextOccurrenceDates", () => {
  it("continua depois da última visita, sem repeti-la", () => {
    expect(nextOccurrenceDates("2026-09-24", "biweekly", 2)).toEqual(["2026-10-08", "2026-10-22"]);
  });

  it("não renova serviço avulso", () => {
    expect(nextOccurrenceDates("2026-08-27", "one_time", 4)).toEqual([]);
  });

  it("emenda a semana seguinte à última gerada", () => {
    expect(nextOccurrenceDates("2026-08-31", "weekly", 3)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
    ]);
  });
});
