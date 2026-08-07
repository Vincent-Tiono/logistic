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
    },
  },
];
