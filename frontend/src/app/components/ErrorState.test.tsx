import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("is announced as an alert and retries on click", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="No hay conexión." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No hay conexión.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when there is no handler", () => {
    render(<ErrorState message="Error" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
