import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

function Harness({ onConfirm = vi.fn() }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Revocar</button>
      <ConfirmDialog
        open={open}
        variant="danger"
        title="Revocar enlace"
        description="El equipo dejará de enviar datos."
        confirmLabel="Confirmar revocación"
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("focuses Cancel on open, describes the consequence and returns focus on close", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Revocar" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Revocar enlace" });
    expect(dialog).toHaveAccessibleDescription("El equipo dejará de enviar datos.");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("runs onConfirm only from the confirm button", () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Revocar" }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar revocación" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
