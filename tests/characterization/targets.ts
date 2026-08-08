import { NODE_BASE_URL, PHP_BASE_URL } from "./global-setup.js";

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
  };
}

export const targets: Target[] = [
  {
    name: "PHP (current)",
    baseUrl: PHP_BASE_URL,
    paths: {
      login: "/login.php",
      home: "/home.php",
      createUser: "/create_user.php",
      logout: "/logout.php",
      vessel: "/Operation/1vessel.php",
      shipper: "/Operation/2shipper.php",
      vendor: "/Operation/3vendor.php",
      barges: "/Operation/4barges.php",
      jetty: "/Operation/5jetty.php",
      flf: "/Operation/6flf.php",
      sibarges: "/Operation/7sibarges.php",
    },
  },
  {
    name: "Node/Fastify (ported)",
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
    },
  },
];
