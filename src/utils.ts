import * as mysql from "mysql2";
export let connection = mysql.createConnection({
  host: "mysql-abouweb.alwaysdata.net",
  user: "abouweb_self",
  password: "Abou1234$",
  database: "abouweb_bdd",
});

export const status = {
  ADMIN: "ADMIN",
  ELEVE: "ELEVE",
};
