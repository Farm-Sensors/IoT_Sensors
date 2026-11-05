import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CropPhotoPicker, type ChosenPhoto } from "./CropPhotoPicker";

const pages = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i), {
  index: i + 1, title: `File:Foto ${i + 1}.jpg`,
  imageinfo: [{ mime: "image/jpeg", width: 2000, thumburl: `https://upload.wikimedia.org/thumb/${i + 1}.jpg`, descriptionurl: `https://commons.wikimedia.org/wiki/File:Foto_${i + 1}.jpg`, extmetadata: { Artist: { value: `<a>Autor ${i + 1}</a>` }, LicenseShortName: { value: "CC BY 4.0" } } }],
}]));

function Harness({ initial = null }: { initial?: ChosenPhoto | null }) {
  const [photo, setPhoto] = useState<ChosenPhoto | null>(initial);
  return <><CropPhotoPicker cropName="Nogal" value={photo} onChange={setPhoto} /><output data-testid="elegida">{photo?.url ?? "ninguna"}</output></>;
}

beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ query: { pages } }) })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("no busca nada hasta que se pide y muestra solo las primeras 6 opciones", async () => {
  render(<Harness />);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText(/Sin foto: se muestra el ícono/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Buscar fotos/ }));
  const options = await screen.findAllByRole("button", { name: /Elegir esta foto/ });
  expect(options).toHaveLength(6);
  // Sin texto escrito se usa la búsqueda sugerida del cultivo.
  expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain("walnut");
});

it("elige una foto con su atribución y permite quitarla para volver al ícono", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: /Buscar fotos/ }));
  fireEvent.click((await screen.findAllByRole("button", { name: /Elegir esta foto/ }))[2]);
  expect(screen.getByTestId("elegida")).toHaveTextContent("https://upload.wikimedia.org/thumb/3.jpg");
  expect(screen.getByText("Autor 3 · CC BY 4.0")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
  await waitFor(() => expect(screen.getByTestId("elegida")).toHaveTextContent("ninguna"));
  expect(screen.getByText(/Sin foto: se muestra el ícono/)).toBeTruthy();
});

it("explica cuando no hay conexión sin impedir guardar el cultivo", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: /Buscar fotos/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Puedes guardar el cultivo sin foto");
});
