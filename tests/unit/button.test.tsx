import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("é acessível por nome e teclado", async () => { const click = vi.fn(); render(<Button onClick={click}>Salvar série</Button>); await userEvent.setup().tab(); expect(screen.getByRole("button", {name:"Salvar série"})).toHaveFocus(); await userEvent.keyboard("{Enter}"); expect(click).toHaveBeenCalledOnce(); });
});
