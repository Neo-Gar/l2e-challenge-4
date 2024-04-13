import { Balance } from "@proto-kit/library";
import { Balances } from "./balances";
import { ModulesConfig } from "@proto-kit/common";
import {Spy} from "./Spy";

export const modules = {
  Balances,
  Spy
};

export const config: ModulesConfig<typeof modules> = {
  Balances: {
    totalSupply: Balance.from(10_000),
  },
  Spy: {}
};

export default {
  modules,
  config,
};
