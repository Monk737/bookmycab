import { getSink, type Attrs } from "./sink";

export function incCounter(name: string, attributes: Attrs = {}, value = 1): void {
  getSink().metric({ name, kind: "counter", value, attributes });
}

export function recordHistogram(name: string, value: number, attributes: Attrs = {}): void {
  getSink().metric({ name, kind: "histogram", value, attributes });
}
