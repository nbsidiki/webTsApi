import { connection } from "./utils";
import { generate, verify, isHashed } from "password-hash";
import { UserConnection, UserCreation } from "./bdd/user";
import { status } from "./utils";
import { IEleve } from "./bdd/eleve";
import { INote } from "./bdd/note";

const express = require("express");
const app = express();
app.use(express.json());
const port: number = 3000;

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

app.post("/users", async (req: any, res: any) => {
  if (req.body.email != "" && req.body.password != "") {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });
    let checked: any = false;
    //console.log("request", req.body);
    let query: string = `SELECT *FROM users WHERE ?`;
    let value: any = {
      email: req.body.email,
    };
    const check = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (err, result: any) => {
          console.log("result", result.length);

          if (result?.length == 0) {
            return resolve(true);
          }
        });
      });
    };

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
        res.sendStatus(200);
        connection.end();
      });
    } else {
      res.send("Le user existe déjà");
      connection.end();
    }
  } else {
    res.send("les champs email et password sont obligatoires");
  }
});

app.post("/me", async (req: any, res: any) => {
  connection.connect(function (err) {
    if (err) {
      console.error("error connecting: " + err.stack);
      return;
    }

    console.log("connected as id " + connection.threadId);
  });
  let checked: any = false;
  let query: string = "SELECT *FROM users WHERE ?";
  const value: any = {
    email: req.body.email,
  };
  const checke = () => {
    return new Promise((resolve, reject) => {
      connection.query(query, value, (error: any, results: any, fields) => {
        if (error)
          throw {
            error,
          };
        console.log("result:", results);
        if (
          req.body.password &&
          verify(req.body.password, results[0].password)
        ) {
          return resolve(true);
        }
      });
    });
  };

  checked = await checke();

  if (checked) {
    query = `UPDATE users SET ?  WHERE email = "${req.body.email}"`;
    const conexionInfo = makeToken(25);
    connection.query(query, conexionInfo, (error: any, results: any) => {
      if (error) throw error;
      res.send(conexionInfo);
    });
  } else {
    res.send("Mot de passe incorrect ou non-renseigné");
  }
  connection.end();
});

app.post("/eleves", async (req: any, res: any) => {
  console.log(req.headers["authorization"]);
  if (req.headers["authorization"] != null) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    const value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          if (results?.length == 0) {
            res.sendStatus(401);
            return resolve(false);
          }
          if (
            results[0]?.token == `${req.headers["authorization"]}` &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (
      req.body.firstName &&
      req.body.lastName &&
      req.body.filiere &&
      Validation
    ) {
      let checked: any = false;
      let query: string = `SELECT *FROM eleves WHERE ?`;
      let value: any = {
        lastName: req.body.lastName,
      };

      const checke = () => {
        return new Promise((resolve, reject) => {
          connection.query(query, value, (err, result: any) => {
            if (err) throw err;
            if (result?.length == 0) {
              return resolve(true);
            }
          });
        });
      };

      checked = await checke();
      if (checked) {
        let query: string = "INSERT INTO eleves SET ?";
        let value: IEleve = {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          filiere: req.body.filiere,
          classe: req.body.classe,
        };
        connection.query(query, value, (err, result) => {
          if (err) throw err;

          res.send("Ajouter avec succès");
          connection.end();
        });
      } else {
        res.send("l'élève existe déjà");
        connection.end();
      }
    } else {
      res.send("Veillez renseigner les informations necessaire");
    }
  } else {
    res.sendStatus(401);
  }
});

app.get("/eleves", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    const value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          if (results?.length == 0) {
            res.sendStatus(401);
            res.send("Veillez vous connectez");
            resolve(false);
          }
          if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3 &&
            results[0].status == status.ADMIN
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (Validation) {
      let query: string = `SELECT *FROM eleves`;
      connection.query(query, {}, (err, results) => {
        res.send(results);
      });
      connection.end();
    }
  } else {
    res.sendStatus(401);
    res.send("Unauthorized");
  }
});

app.get("/eleves/:id", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    const value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          if (results?.length == 0) {
            res.sendStatus(401);
            res.send("Veillez vous connectez");
            resolve(false);
          }
          if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3 &&
            results[0].status == status.ADMIN
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (Validation) {
      let query: string = `SELECT *FROM eleves WHERE id = ${req.params.id}`;
      connection.query(query, {}, (err, results) => {
        res.send(results);
      });
      connection.end();
    }
  } else {
    res.sendStatus(401);
    res.send("Unauthorized");
  }
});

app.put("/eleves/:id", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    let value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          console.log("result:", results);
          if (results?.length == 0) {
            res.sendStatus(401);
            resolve(false);
          } else if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3 &&
            results[0].status == status.ADMIN
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (Validation) {
      query = `UPDATE eleves SET ?  WHERE id = ${req.params.id}`;
      value = req.body;

      connection.query(query, value, (err, result) => {
        if (err) throw err;
        res.send("Modified Success");
      });
      connection.end();
    }
  } else {
    res.send("authorization Denied");
    res.sendStatusCode(401);
  }
});

app.delete("/eleves/:id", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    const value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          console.log("result:", results);
          if (results?.length == 0) {
            res.sendStatus(401);
            res.send("Veillez vous connectez");
            resolve(false);
          } else if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3 &&
            results[0].status == status.ADMIN
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (Validation) {
      let query: string = `DELETE *FROM eleves WHERE id = ${req.params.id}  AND IF EXISTS(SELECT *FROM notes WHERE eleveId = ${req.params.id} ) DELETE *FROM notes WHERE eleveId = ${req.params.id}`;
      connection.query(query, {}, (err, results) => {
        if (err) throw err;
        res.send(results);
      });
      connection.end();
    }
  } else {
    res.sendStatus(401);
    res.send("Unauthorized");
  }
});

app.get("/notes", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    const value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          if (results?.length == 0) {
            res.sendStatus(401);
            res.send("Veillez vous connectez");
            resolve(false);
          }
          if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3 &&
            results[0].status == status.ADMIN
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (Validation) {
      let query: string = `SELECT *FROM notes`;
      connection.query(query, {}, (err, results) => {
        res.send(results);
      });
      connection.end();
    }
  } else {
    res.sendStatus(401);
    res.send("Unauthorized");
  }
});

app.get("/notes/:eleveId", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    const value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          if (results?.length == 0) {
            res.sendStatus(401);
            res.send("Veillez vous connectez");
            resolve(false);
          }
          if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (Validation) {
      let query: string = `SELECT *FROM notes WHERE eleveId = ${req.params.eleveId}`;
      connection.query(query, {}, (err, results) => {
        res.send(results);
      });
      connection.end();
    }
  } else {
    res.sendStatus(401);
    res.send("Unauthorized");
  }
});

app.get("/notes/:matiere", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    const value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          if (results?.length == 0) {
            res.sendStatus(401);
            res.send("Veillez vous connectez");
            resolve(false);
          }
          if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3 &&
            results[0].status == status.ADMIN
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (Validation) {
      let query: string = `SELECT *FROM eleves WHERE matiere = ${req.params.matiere}`;
      connection.query(query, {}, (err, results) => {
        res.send(results);
      });
      connection.end();
    }
  } else {
    res.sendStatus(401);
    res.send("Unauthorized");
  }
});

app.put("/notes/:id", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    let value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          console.log("result:", results);
          if (results?.length == 0) {
            res.sendStatus(401);
            res.send("Veillez vous connectez");
            resolve(false);
          } else if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3 &&
            results[0].status == status.ADMIN
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (Validation) {
      query = `UPDATE notes SET ?  WHERE id = ${req.params.id}`;
      value = req.body;

      connection.query(query, value, (err, result) => {
        if (err) throw err;
        res.send("Modified Success");
      });
      connection.end();
    }
  } else {
    res.send("authorization Denied");
    res.sendStatusCode(401);
  }
});

app.post("/notes", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    const value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          console.log("result:", results);
          if (results?.length == 0) {
            res.sendStatus(401);
            res.send("Veillez vous connectez");
            resolve(false);
          } else if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3 &&
            results[0].status == status.ADMIN
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (req.body.eleveId && req.body.matiere && req.body.note && Validation) {
      const query: string = "INSERT INTO notes SET ?";
      const value: INote = {
        eleveId: req.body.eleveId,
        matiere: req.body.matiere,
        note: req.body.note,
      };
      connection.query(query, value, (error, results, fields) => {
        if (error) throw error;
        res.sendStatus(200);
        connection.end();
      });
    }
  }
});

app.get("/disconnect", async (req: any, res: any) => {
  if (req.headers["authorization"]) {
    connection.connect(function (err) {
      if (err) {
        console.error("error connecting: " + err.stack);
        return;
      }

      console.log("connected as id " + connection.threadId);
    });

    let query: string = "SELECT *FROM users WHERE ?";
    const value: any = {
      token: req.headers["authorization"],
    };
    const Authorized = () => {
      return new Promise((resolve, reject) => {
        connection.query(query, value, (error: any, results: any, fields) => {
          if (error)
            throw {
              error,
            };
          if (results?.length == 0) {
            res.sendStatus(401);
            res.send("Veillez vous connectez");
            resolve(false);
          }
          if (
            results[0].token == req.headers["authorization"] &&
            new Date().getHours() - results[0].conexionDate.getHours() <= 3
          ) {
            return resolve(true);
          }
        });
      });
    };

    const Validation = await Authorized();
    if (Validation) {
      query = `UPDATE users SET ?  WHERE token = "${req.headers["authorization"]}"`;
      const disConexionInfo: any = {
        token: null,
        conexionDate: null,
      };
      connection.query(query, disConexionInfo, (error: any, results: any) => {
        if (error) throw error;
        res.send(200);
      });
    }
    connection.end();
  } else {
    res.send("Vous n'etes pas connecté");
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
