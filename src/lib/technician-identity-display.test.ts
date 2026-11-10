import { describe, expect, it } from "vitest";
import {
  maskedVerifiedPhoneTail, technicianInitials, verifiedLegacyAvatarSource,
} from "@/lib/technician-identity-display";

describe("Technician profile presentation is private by default", () => {
  it("renders clear initials without inventing a portrait", () => {
    expect(technicianInitials("José da Silva")).toBe("JD");
    expect(technicianInitials("  ")).toBe("T");
    expect(technicianInitials("Técnica")).toBe("T");
  });

  it("accepts only a four-digit suffix, never a full phone number", () => {
    expect(maskedVerifiedPhoneTail("1234")).toBe("•••• 1234");
    expect(maskedVerifiedPhoneTail("+5541999991234")).toBeNull();
    expect(maskedVerifiedPhoneTail("123")).toBeNull();
    expect(maskedVerifiedPhoneTail("12345")).toBeNull();
    expect(maskedVerifiedPhoneTail(null)).toBeNull();
  });

  it("rejects arbitrary pictures and permits only independently verified legacy originals", () => {
    expect(verifiedLegacyAvatarSource("https://res.cloudinary.com/dqnwlodjs/image/upload/v1794269310/encontreumtecnico/legacy/wp-candidate-530.webp")).toContain("wp-candidate-530.webp");
    expect(verifiedLegacyAvatarSource("https://example.com/photo.jpg")).toBeNull();
    expect(verifiedLegacyAvatarSource("javascript:alert(1)")).toBeNull();
    expect(verifiedLegacyAvatarSource(null)).toBeNull();
  });
});
