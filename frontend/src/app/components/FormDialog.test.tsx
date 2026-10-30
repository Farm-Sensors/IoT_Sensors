import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";
import { FormDialog } from "./FormDialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Nuevo Cliente</button>
      <FormDialog open={open} title="Nuevo Cliente" onClose={() => setOpen(false)}>
        <form>
          <Field label="Nombre de la Empresa"><input required type="text" /></Field>
        </form>
      </FormDialog>
    </>
  );
}

describe("FormDialog", () => {
  it("is a named dialog, labels its fields, closes with the button and returns focus", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Nuevo Cliente" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Nuevo Cliente" })).toBeTruthy();
    expect(screen.getByLabelText("Nombre de la Empresa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("closes with Escape and keeps the form open when clicking outside", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo Cliente" }));
    const overlay = document.querySelector("[data-state='open'].fixed") as HTMLElement | null;
    if (overlay) fireEvent.pointerDown(overlay);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
