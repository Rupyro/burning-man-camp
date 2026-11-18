// Power: generators and fuel. A camp can pick it on its own; sound and mutant-vehicle pull it in.
import { definePack } from "../../src/lib/camp-packs";

export default definePack({
  key: "power",
  label: "Power",
  obligations: [{ key: "gas_fuel", label: "Gas and fuel storage limits" }],
});
