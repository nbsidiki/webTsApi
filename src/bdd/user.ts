/* create tables with user "dev": 
mysql -u dev -p
use demo
create table users(id int auto_increment, name varchar(255), token varchar(255), primary key(id));
*/

export interface UserCreation {
  active: boolean;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  status: string;
}
export interface UserConnection {
  email: string;
  password: string;
}
