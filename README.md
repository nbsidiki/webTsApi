# webTsApi

Cette api s'occupe de la question de note.

Le processus est simple :
-les élèves et l'administration peuvent créer des comptes la différence se trouve dans le status (ADMIN OU ELEVE)
-Seuls les comptes ADMIN connectés peuvent ajouter dans les élèves (dans la table 'eleves') et les notes
-Toutes les actions que ça soit ADMIN ou ELEVE necessitent d'être connecté et le token généré "manuellement" est stocké en BDD avec la date de connection
-les ADMIN peuvent en plus d'ajouter les élèves les supprimer aussi et donc normalement supprimer les notes associées à ces élèves en meme temps.
-une note peut être modifiée par les ADMIN mais pas supprimée
-les élèves peuvent consulter leurs notes une fois connecté avec leur 'id' unique (eleveId) qui doit leur être communiqué par l'admin qui les a ajouté

# Demarrer en local

-npm intall
-npm run start
