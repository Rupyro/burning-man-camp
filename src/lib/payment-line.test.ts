import { describe, expect, it } from "vitest";
import { paymentLine } from "./payment-line";

describe("profile payment line", () => {
  it("stays hidden when we don't know yet", () => {
    expect(paymentLine(null)).toBeNull();
    expect(paymentLine({ status: "unknown" })).toBeNull();
  });
  it("says it plainly when we do know", () => {
    expect(paymentLine({ status: "deposit_paid" })).toBe("Deposit paid");
    expect(paymentLine({ status: "paid_in_full" })).toBe("Paid in full");
    expect(paymentLine({ status: "waived" })).toBe("No payment needed");
    expect(paymentLine({ status: "overdue" })).toBe("Payment overdue");
    expect(paymentLine({ status: "something_new" })).toBe("something new");
  });
});
