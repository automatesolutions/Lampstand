import { describe, expect, it } from "vitest";
import { closePrayer } from "./prayer-close";

describe("closePrayer", () => {
  it("adds the closing to a prayer without one", () => {
    expect(closePrayer("help me to trust You still.")).toBe("help me to trust You still.\n\nIn Jesus' Name, Amen.");
  });

  it("replaces the model's own closing", () => {
    expect(closePrayer("trust You still.\n\nThrough Jesus Christ our Lord. Amen.")).toBe("trust You still.\n\nIn Jesus' Name, Amen.");
    expect(closePrayer("trust You still. Amen.")).toBe("trust You still.\n\nIn Jesus' Name, Amen.");
    expect(closePrayer("trust You still. In Jesus' name, amen")).toBe("trust You still.\n\nIn Jesus' Name, Amen.");
    expect(closePrayer("trust You still.\nIn Jesus' name.")).toBe("trust You still.\n\nIn Jesus' Name, Amen.");
  });

  it("leaves other mentions of Jesus alone", () => {
    expect(closePrayer("Thank You for Jesus, who calls me by name.")).toBe("Thank You for Jesus, who calls me by name.\n\nIn Jesus' Name, Amen.");
  });
});
