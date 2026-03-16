import { handleGetMyDesigners } from "../../src/tools/designer.js";
import { createMockClient, mockDesigner } from "../helpers/mocks.js";

describe("handleGetMyDesigners", () => {
  it("calls client.getDesigners and returns JSON", async () => {
    const client = createMockClient();
    const designers = [mockDesigner(), mockDesigner({ id: "d-2", name: "Studio B" })];
    (client.getDesigners as ReturnType<typeof vi.fn>).mockResolvedValue(designers);

    const handler = handleGetMyDesigners(client);
    const result = await handler();

    expect(client.getDesigners).toHaveBeenCalled();
    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe("designer-789");
  });

  it("returns correct content structure", async () => {
    const client = createMockClient();
    (client.getDesigners as ReturnType<typeof vi.fn>).mockResolvedValue([mockDesigner()]);

    const handler = handleGetMyDesigners(client);
    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty("type", "text");
  });
});
