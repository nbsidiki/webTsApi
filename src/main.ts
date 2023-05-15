import { connection } from "./utils";
import { generate, verify, isHashed } from "password-hash";
import { UserConnection, UserCreation } from "./bdd/user";
import { status } from "./utils";
import { IEleve } from "./bdd/eleve";
import { INote } from "./bdd/note";

const express = require("express");
const app = express();
app.use(express.json());
const port = process.env.PORT ?? 3000;

//generated Token
function makeToken(length: number): any {
  let result: any = "";
  const characters: string =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return {
    token: result,
    conexionDate: new Date(),
  };
}

//console.log(makeToken(15));

app.get("/", (req: any, res: any) => {
  res.send("Hello World!");
});

// se connecter à la base de données une seule fois au démarrage de l'application
connection.connect(function (err) {
  if (err) {
    console.error("error connecting: " + err.stack);
    return;
  }

  console.log("connected as id " + connection.threadId);
});

async function getUserByToken(token: string) {
  const query = "SELECT * FROM users WHERE token = ?";
  const values = [token];
  const [user] = await connection.promise().query(query, values);
  return user;
}

async function getEleves() {
  const query = "SELECT * FROM eleves";
  const [eleves] = await connection.promise().query(query);
  return eleves;
}

app.post("/users", async (req: any, res: any) => {
  if (req.body.email !== "" && req.body.password !== "") {
    let checked: any = false;
    //console.log("request", req.body);
    let query = `SELECT *FROM users WHERE ?`;
    let value: any = {
      email: req.body.email,
    };
    const check = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (err, result: any) => {
          console.log("result", result.length);

          if (result?.length == 0) {
            return resolve(true);
          } else {
            return resolve(false);
          }
        });
      });
    };
    try {
      if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
        res.status(401).send({ message: "Unauthorized" });
      }
      checked = await check();
      if (checked) {
        let query: string = "INSERT INTO users SET ?";
        let value: UserCreation = {
          active: req.body.active,
          email: req.body.email,
          birthDate: req.body.birthDate,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          password: generate(req.body.password, { algorithm: "sha256" }),
          status: req.body.status,
        };
        connection.query(query, value, (error, results, fields) => {
          if (error) throw error;
          console.log("Résultat de l'insert", results);
          res.sendStatus(201);
        });
      } else {
        res.send("Le user existe déjà");
      }
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  } else {
    res.send("les champs email et password sont obligatoires");
  }
});
// endpoint POST pour vérifier les informations d'authentification d'un utilisateur
app.post("/me", async (req: any, res: any) => {
  let checked: any = false;
  let query: string = "SELECT * FROM users WHERE ?";
  const value: any = {
    email: req.body.email,
  };

  // vérifier les informations d'authentification de l'utilisateur
  const check = () => {
    return new Promise((resolve, reject) => {
      connection.query(query, value, (error: any, results: any, fields) => {
        if (error) {
          reject(error);
          return;
        }

        if (
          req.body.password &&
          verify(req.body.password, results[0]?.password)
        ) {
          resolve(true);
        } else {
          res.sendStatus(401);
          reject(false);
        }
      });
    });
  };

  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }
    checked = await check();
    if (checked) {
      // mettre à jour le jeton d'accès de l'utilisateur dans la base de données
      query = `UPDATE users SET ? WHERE email = "${req.body.email}"`;
      const connectionInfo = makeToken(25);
      connection.query(query, connectionInfo, (error: any, results: any) => {
        if (error) throw error;
        res.send(connectionInfo);
      });
    } else {
      res.send("Mot de passe incorrect ou non-renseigné");
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.post("/eleves", async (req: any, res: any) => {
  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }
    const token = split(req.headers["authorization"], " ")[1];
    if (!token) {
      return res.sendStatus(401);
    }

    const user: any = await runQuery("SELECT * FROM users WHERE token = ?", [
      token,
    ]);

    if (!user || !isWithin3Hours(user[0].conexionDate)) {
      return res.sendStatus(401);
    }

    const { firstName, lastName, filiere, classe } = req.body;
    if (!firstName || !lastName || !filiere) {
      return res
        .status(400)
        .send("Veillez renseigner les informations necessaire");
    }

    const existingEleve: any = await runQuery(
      "SELECT * FROM eleves WHERE lastName = ?",
      [lastName]
    );

    if (existingEleve?.length != 0) {
      return res.status(409).send("L'élève existe déjà");
    }
    const result = await runQuery("INSERT INTO eleves SET ?", {
      firstName,
      lastName,
      filiere,
      classe,
    });
    res.send("Ajouter avec succès");
  } catch (error) {
    console.error(error);
    res.status(500).send("Une erreur est survenue");
  }
});

app.get("/eleves", async (req: any, res: any) => {
  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }
    if (!split(req.headers["authorization"], " ")[1]) {
      return res.status(401).send("Unauthorized");
    }

    const user: any = await getUserByToken(
      split(req.headers["authorization"], " ")[1]
    );

    if (!user) {
      return res.status(401).send("Please log in");
    }

    if (user.status !== status.ADMIN) {
      return res.status(401).send("Unauthorized");
    }

    const eleves = await getEleves();
    return res.send(eleves);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});

// Helper function to check if the connection date is within 3 hours
function isWithin3Hours(date: Date): boolean {
  const now = new Date();
  const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return hoursDiff <= 3;
}

// Helper function to run a SQL query
function runQuery(query: string, values: any): Promise<any> {
  return new Promise((resolve, reject) => {
    connection.query(query, values, (error, results, fields) => {
      if (error) {
        return reject(error);
      }
      return resolve(results);
    });
  });
}

app.get("/eleves/:id", async (req: any, res: any) => {
  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }

    const token = split(req.headers["authorization"], " ")[1];
    if (!token) {
      return res.status(401).send("Unauthorized");
    }

    const userQuery = "SELECT * FROM users WHERE ?";
    const userValue = { token };
    const userResult = await runQuery(userQuery, userValue);

    if (userResult.length === 0) {
      return res.status(401).send("Please log in");
    }

    const user = userResult[0];
    const isAdmin = user.status === status.ADMIN;
    const isAuthorized = isAdmin && isWithin3Hours(user.conexionDate);

    if (!isAuthorized) {
      return res.status(401).send("Unauthorized");
    }
    let eleveQuery: any;
    let eleveValue: any;
    const hasNumber = /^-?\d+$/.test(req.params.id);
    if (hasNumber) {
      eleveQuery = "SELECT * FROM eleves WHERE id = ?";
      eleveValue = [req.params.id];
    } else {
      eleveQuery = "SELECT * FROM eleves WHERE filiere = ?";
      eleveValue = [req.params.id];
    }
    const eleveResult = await runQuery(eleveQuery, eleveValue);

    if (eleveResult.length === 0) {
      return res.status(404).send("Student not found");
    }

    const eleve = eleveResult;
    res.send(eleve);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.put("/eleves/:id", async (req: any, res: any) => {
  if (!split(req.headers["authorization"], " ")[1]) {
    return res.sendStatus(401);
  }

  const userQuery = "SELECT * FROM users WHERE token = ?";
  const userValues = [split(req.headers["authorization"], " ")[1]];
  let userResult;

  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }
    userResult = await runQuery(userQuery, userValues);
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
  if (
    !userResult[0] ||
    userResult[0].status !== status.ADMIN ||
    !isWithin3Hours(userResult[0].conexionDate)
  ) {
    return res.sendStatus(401);
  }

  const updateQuery = "UPDATE eleves SET ? WHERE id = ?";
  const updateValues = [req.body, req.params.id];

  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }
    const updateResult: any = await runQuery(updateQuery, updateValues);
    if (updateResult.affectedRows === 0) {
      return res.sendStatus(404);
    }
    res.send("Modified Success");
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
});

app.delete("/eleves/:id", async (req: any, res: any) => {
  if (!split(req.headers["authorization"], " ")[1]) {
    res.sendStatus(401);
    return;
  }
  const DELETE_ELEVE_QUERY = `DELETE FROM eleves WHERE id = ?`;
  const DELETE_NOTES_QUERY = `DELETE FROM notes WHERE eleveId = ?`;
  const SELECT_USER_QUERY = `SELECT *FROM users WHERE token = ?`;

  const userResults: any = await runQuery(SELECT_USER_QUERY, [
    split(req.headers["authorization"], " ")[1],
  ]);

  // Si aucun utilisateur trouvé, envoie une réponse 401
  if (userResults?.length == 0) {
    res.sendStatus(401);
    return;
  }

  const user = userResults[0];
  // Si l'utilisateur n'est pas un administrateur, envoie une réponse 401
  if (user.status !== status.ADMIN) {
    res.sendStatus(401);
    return;
  }

  // Si l'utilisateur n'est pas connecté depuis moins de 3 heures, envoie une réponse 401
  if (!isWithin3Hours(user.conexionDate)) {
    res.sendStatus(401);
    return;
  }

  // Vérifie si l'élément à supprimer existe
  const [eleveResults]: any = await runQuery(
    `SELECT * FROM eleves WHERE id = ?`,
    [req.params.id]
  );

  // Si l'élément à supprimer n'existe pas, envoie une réponse 404
  if (eleveResults?.length == 0) {
    res.sendStatus(404);
    return;
  }

  // Supprime l'élément et les notes associées
  connection.beginTransaction(function (err: any) {
    if (err) {
      throw err;
    }
    connection.query(
      DELETE_ELEVE_QUERY,
      [req.params.id],
      function (error: any, results: any, fields: any) {
        if (error) {
          connection.rollback(function () {
            throw error;
          });
        }
        connection.query(
          DELETE_NOTES_QUERY,
          [req.params.id],
          function (error: any, results: any, fields: any) {
            if (error) {
              connection.rollback(function () {
                throw error;
              });
            }
            connection.commit(function (err: any) {
              if (err) {
                connection.rollback(function () {
                  throw err;
                });
              }
              res.send(
                `L'élève avec l'ID ${req.params.id} a été supprimé avec succès.`
              );
            });
          }
        );
      }
    );
  });
});

app.get("/notes", async (req: any, res: any) => {
  if (!split(req.headers["authorization"], " ")[1]) {
    res.sendStatus(401);
    return;
  }

  let query = "SELECT * FROM users WHERE token = ?";
  const value = split(req.headers["authorization"], " ")[1];
  const userResults: any = await runQuery(query, [value]);

  if (userResults?.length == 0) {
    res.sendStatus(401);
    res.send("Veillez vous connecter");
    return;
  }

  const user = userResults[0];

  if (
    user.token != split(req.headers["authorization"], " ")[1] ||
    !isWithin3Hours(user.conexionDate) ||
    user.status != status.ADMIN
  ) {
    res.sendStatus(401);
    return;
  }

  query = "SELECT * FROM notes";
  connection.query(query, {}, (err, results) => {
    if (err) {
      throw err;
    }
    res.send(results);
  });
});

app.get("/notes/:matiere", async (req: any, res: any) => {
  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }
    const token = split(req.headers["authorization"], " ")[1];
    if (!token) {
      return res.sendStatus(401);
    }
    const userQuery = "SELECT * FROM users WHERE token = ?";
    const userResults: any = await runQuery(userQuery, [token]);
    if (userResults.length === 0) {
      return res.sendStatus(401);
    }
    const user = userResults[0];
    const isAdmin = user.status === status.ADMIN;

    if (!isWithin3Hours(user.conexionDate)) {
      return res.sendStatus(401);
    }
    const hasNumber = /^-?\d+$/.test(req.params.matiere);
    if (!hasNumber && isAdmin) {
      const matiere = req.params.matiere;
      const elevesQuery = "SELECT * FROM notes WHERE matiere = ?";
      const [elevesResults] = await runQuery(elevesQuery, [matiere]);
      res.send(elevesResults);
    }
    if (hasNumber) {
      const eleveId = req.params.matiere;
      const elevesQuery = "SELECT * FROM notes WHERE eleveId = ?";
      const elevesResults: any = await runQuery(elevesQuery, [eleveId]);
      res.send(elevesResults);
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.put("/notes/:id", async (req: any, res: any) => {
  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }
    const token = split(req.headers["authorization"], " ")[1];
    if (!token) {
      return res.sendStatus(401);
    }

    const userQuery = "SELECT * FROM users WHERE token = ?";
    const userResults: any = await runQuery(userQuery, [token]);
    if (userResults.length === 0) {
      return res.sendStatus(401);
    }

    const user = userResults[0];
    const isAdmin = user.status === status.ADMIN;
    if (!isAdmin || !isWithin3Hours(user.conexionDate)) {
      return res.sendStatus(401);
    }

    const noteId = req.params.id;
    const updateQuery = "UPDATE notes SET ? WHERE id = ?";
    const updateValues = [req.body, noteId];

    await runQuery(updateQuery, updateValues);
    res.send("Modified Success");
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.post("/notes", async (req: any, res: any) => {
  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }
    const token = split(req.headers["authorization"], " ")[1];
    if (!token) {
      return res.sendStatus(401);
    }

    const userQuery = "SELECT * FROM users WHERE token = ?";
    const userResults = await runQuery(userQuery, [token]);
    if (userResults.length === 0) {
      return res.sendStatus(401);
    }

    const user = userResults[0];
    const isAdmin = user.status === status.ADMIN;

    if (!isAdmin || !isWithin3Hours(user.conexionDate)) {
      return res.sendStatus(401);
    }

    const { eleveId, matiere, note } = req.body;
    if (!eleveId || !matiere || !note) {
      return res.sendStatus(400);
    }

    const insertQuery = "INSERT INTO notes SET ?";
    const insertValues = { eleveId, matiere, note };

    await runQuery(insertQuery, insertValues);
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.put("/disconnect", async (req: any, res: any) => {
  try {
    if (split(req.headers["authorization"], " ")[0] !== "Bearer") {
      res.status(401).send({ message: "Unauthorized" });
    }
    const token = split(req.headers["authorization"], " ")[1];
    if (!token) {
      return res.send("Vous n'êtes pas connecté");
    }

    const userQuery = "SELECT * FROM users WHERE token = ?";
    const userResults: any = await runQuery(userQuery, [token]);
    if (userResults.length === 0) {
      return res.sendStatus(401);
    }

    const user = userResults[0];
    if (!isWithin3Hours(user.conexionDate)) {
      return res.sendStatus(401);
    }

    const updateQuery =
      "UPDATE users SET token = NULL, conexionDate = NULL WHERE token = ?";
    await runQuery(updateQuery, [token]);
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// gérer les erreurs non capturées
process.on("unhandledRejection", (err) => {
  console.error(err);
  process.exit(1);
});

// fermer la connexion à la base de données lorsque l'application est arrêtée
process.on("SIGINT", () => {
  connection.end();
});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
function split(arg0: any, arg1: string) {
  throw new Error("Function not implemented.");
}
