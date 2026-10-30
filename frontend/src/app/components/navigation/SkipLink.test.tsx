import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { SkipLink } from "./SkipLink";

describe("SkipLink", () => {
  it("moves focus to the main content without navigating", () => {
    const ref = createRef<HTMLElement>();
    render(
      <>
        <SkipLink targetRef={ref} />
        <main id="contenido" ref={ref} tabIndex={-1}>Contenido</main>
      </>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Saltar al contenido" }));
    expect(screen.getByRole("main")).toHaveFocus();
  });
});
