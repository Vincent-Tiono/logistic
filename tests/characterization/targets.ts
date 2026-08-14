import { NODE_BASE_URL } from "./global-setup.js";

export interface Target {
  name: string;
  baseUrl: string;
  paths: {
    login: string;
    home: string;
    createUser: string;
    logout: string;
    vessel: string;
    shipper: string;
    vendor: string;
    barges: string;
    jetty: string;
    flf: string;
    sibarges: string;
    tluOperation: string;
    coalBarging: string;
    jisdor: string;
    kursTengah: string;
    fuel: string;
    fuelKurs: string;
  };
}

export const targets: Target[] = [
  {
    name: "Node/Fastify",
    baseUrl: NODE_BASE_URL,
    paths: {
      login: "/login",
      home: "/home",
      createUser: "/create-user",
      logout: "/logout",
      vessel: "/vessel",
      shipper: "/shipper",
      vendor: "/vendor",
      barges: "/barges",
      jetty: "/jetty",
      flf: "/flf",
      sibarges: "/sibarges",
      tluOperation: "/tlu-operation",
      coalBarging: "/coal-barging",
      jisdor: "/jisdor",
      kursTengah: "/kurs-tengah",
      fuel: "/fuel",
      fuelKurs: "/fuel-kurs",
    },
  },
];
