# Local development setup working with Database migrations In TypeORM, NestJS Postures and Docker. 

Working with stateful data and databases is hard, especially when your project grows overtime. To have a good development and project setup right from the beginning is essential for the success of your development project. In this Post I want to show you how I have setup most of the projects and try to highlight some of the thoughts behind the setup. 

In this example we’ll work on a simple NodeJS API that is powered by a Postgres database for data storage. 

<architecture diagram>

 To build our API in NodeJS we will use NestJS. It’s a pretty flexible framework and is built on ExpressJS principals and lets you craft out NodeJS services in no time as it comes with a lot of goodies (like full typescript support, dependency injection, module management) backed in. To kick off things even faster it comes with a nice CLI tool that handles the boilerplate for you. For me the generated NestJS project from the CLI is a perfect starter. 

## The boilerplate: 

I have used the NestJS CLI a couple of times now and I know and understand all of the code it generates. It does not generate stuff I don’t need or understand. Why is this fact important? Because on the long run I have support and maintain all of the things in my project. Generated black magic code is gonne give me hard time building on top when I try to adjust or extend it. That’s why I always prefer starting super small and then adding the things I need over time and learning instead of using an overblown starter project that has a lot of stuff I don’t need, or I don’t understand. 

 

## Getting the project ready

Okay cool, Let’s get started by generating our project with these few lines: 
```bash
npm i -g @nestjs/cli
nest new project-name
```
more on the nestjs and it's cli [here](https://docs.nestjs.com/)

Your project will look something like this:

<screenshot-1>

Lets give it a test run to see if all works so far with.  
```
npm run start:dev
```

## Setting up the database server.

So now we have our project baselines setup, let’s add some data persistence layer. 

We’ll use TypeORM to manage our database and schema. What is nice about TypeORM is, that it allows you to model your data entities in type save code and then is able to apply (sync) these models into the table structure in your database. (By the way, this not only works with postgres databases, but also other databases, find more info on with databases are supported [here](https://typeorm.io))

## Setting up a local postgres database instance with automation! 

To work locally with data persistence, we now would need a database server and a database to connect to. One way would be to setup a postgres database server on your local machine, what I’m not a big fan of. Why? This would tie the project to my machine a lot. Meaning if you work on a project with a team or you simply switch machines you would have to do this on every machine again or writing somehow to setup guide etc. (when you have the also different operating systems on these machines, things get even more icky)

so how do we overcome this?

We automate! We use prebuild postgres docker image and run the database sever as a docker process. Like this we can script e whole setup with a couple lines of shell code to get our server instance running and prepare an empty database ready to connect to. This is great because it’s reproducible and the setup code can be managed in source control together with the rest of the project code. What makes the “getting started” for other dev’s in your team super straightforward. 

Here is how this script would look like: 
```bash
#!/bin/bash
set -e

SERVER="my_database_server";
PW="mysecretpassword";
DB="my_database";

echo "echo stop & remove old docker [$SERVER]";
echo "echo starting new fresh instance of [$SERVER]"
(docker kill $SERVER || :) && \
  (docker rm $SERVER || :) && \
  docker run --name $SERVER -e POSTGRES_PASSWORD=$PW \
  -e PGPASSWORD=$PW \
  -p 5432:5432 \
  -d postgres

# wait for pg to start
echo "sleep wait for pg-server [$SERVER] to start";
SLEEP 3;

# create the db 
echo "CREATE DATABASE $DB ENCODING 'UTF-8';" | docker exec -i $SERVER psql -U postgres
echo "\l" | docker exec -i $SERVER psql -U postgres
``` 

Lets add that command to our package.json run-scripts so we can easy execute it.
```json
...
    "start:dev": "nest start --watch",
    "start:dev:db": "./src/scripts/start-db.sh",
    "start:debug": "nest start --debug --watch",
...
```
Sweet, now we have a command we can call and it would setup the DB server.

To make the process more robust, we will always use the same name for the docker container - like this we can add an additional check - if the container is running already kill it to ensure a clean state. We will come to why this is a good practice later in the “seed data section”.

## Connecting to your database.

Like for everything, there is already an NPM module that helps you hooking the NestJS project to your database. Let’s add TypeORM support to our project by using the prebuild NestJS-to-TypeORM module. 

You can add it like this:
```bash
npm install --save @nestjs/typeorm typeorm pg
```
Full docs can be found [here](https://docs.nestjs.com/techniques/database).
 

## Configuration management 

Now it’s time to hookup things. The way we can tell TypeORM in NestJS to which database server to connect to, is by using the TypeOrmModule. It has a “forRoot” method we can pass the config to.

But here is the challenge. We know that the config will be different on local development and on the production environment. So, this process somehow has to be generic so it can provide different configs for these cases. 

To make this work nicely we can write the following Config service. The idea of this config class is to run before our API Server main.ts starts. It will then have the configuration preloaded from environment variables being able to provide the values then at runtime in a read only manner. 

To make this flexible for dev and prod we will use the [dotenv module](https://www.npmjs.com/package/dotenv). 
You can add it like this:
```bash
npm install --save dotenv
```
With this module we can have a “.env” file in our project on local development to prepare the config values and on production we can just read the values from the environment variables on our production server. This is a pretty flexible approach and also allows you to share the config with other dev’s in your team easy with one file. (I would highly recommend to git ignore this file though, as you might end up putting actual secrets in this file and you for sure don’t want to leak these out of your project, or commit them by accident) 

 
This is how your .env file could look like:
```bash
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=mysecretpassword
POSTGRES_DATABASE=my_database
```

So, our ConfigService would run as a singleton service, loading the config values and providing them to other modules at start. We will include an error early pattern in the service. Meaning it will throw meaning full error if it is asked for configuration it is not able to provide. This makes your setup more robust as you will detect configuration errors at build/boot time, not at runtime. Like this you will be able to detect this early when you deploy or start your server, not when you or worse a consumer uses your app.

This is how your ConfigService could look like. 

```typescript
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

require('dotenv').config(); // will load the values from the .env file

export class ConfigService {
  constructor(private env: { [k: string]: string | undefined }) { }

  private getValue(key: string, throwOnMissing = true): string {
    const value = this.env[key];
    if (!value && throwOnMissing) {
      throw new Error(`config error - missing env.${key}`);
    }

    return value;
  }

  public getPort() {
    return this.getValue('PORT', true);
  }

  public isProduction() {
    const mode = this.getValue('MODE', false);
    return mode != 'DEV';
  }

  public getTypeOrmConfig(): TypeOrmModuleOptions {
    return {
      type: 'postgres',

      host: this.getValue('POSTGRES_HOST'),
      port: parseInt(this.getValue('POSTGRES_PORT')),
      username: this.getValue('POSTGRES_USER'),
      password: this.getValue('POSTGRES_PASSWORD'),
      database: this.getValue('POSTGRES_DATABASE'),

      entities: ['**/*.entity{.ts,.js}'],

      migrationsTableName: 'migration',
      migrations: ['src/migration/*.ts'],
      cli: {
        migrationsDir: 'src/migration',
      },
      synchronize: false,
      ssl: this.isProduction(),
    };
  }

}

const configService = new ConfigService(process.env); // create a singleton

export { configService };
```

Then we simply hook the `ConfigService` to our NestJS Module like this: 
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configService } from './config/config.service';

@Module({
  imports: [
    TypeOrmModule.forRoot(configService.getTypeOrmConfig())
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
```

We are nearly ready to give it a first spinn, but because we actually want to work in typescript in development, 
we will use `nodemon` with deticated a `nodemon.json` to start our development server to run it with the `ts-node` module. 

so lets install `nodemon` and `ts-node`.
```bash
npm i --save-dev nodemon ts-node
```

and we add a `nodemon.json` file: 
```json
{
  "watch": [
    "src"
  ],
  "ext": "ts",
  "ignore": [
    "src/**/*.spec.ts"
  ],
  "exec": "node --inspect=127.0.0.1:9223 -r ts-node/register -- src/main.ts",
  "env": { }
}
```
finally we change the `start:dev` script in the `package.json` to:

```json
{
  "start:dev": "nodemon --config nodemon.json"
}
```

Like this we can run `npm run start:dev` to start our API-server, 
that on start it should pick up the config from the configService 
what then will connect typeORM to our database - sweet!

## Define your data model entities.

TypeORM supports auto loading of your data model entities. You can simply place all of them in one folder and load them with a pattern in your configuration we put ours `model/<name>.entity.ts`. (see the `entities` prop on the `TypeOrmModuleOptions` in the `ConfigService`) 

<screenshot-2>

Another nice feature from TypeORM is that these entity models support inheritance. 
What is greate if you for example have certain data fields you want every of your entities to have, 
for example like an auto generated uuid `id`-field or a `createDateTime`-field.

So, defining your data model in TypeORM would look something like this: 
`base.entity.ts`
```typescript 
import { PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn } from 'typeorm';

export abstract class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'boolean', default: false })
    isArchived: boolean;

    @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    createDateTime: Date;

    @Column({ type: 'varchar', length: 300 })
    createdBy: string;

    @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    lastChangedDateTime: Date;

    @Column({ type: 'varchar', length: 300 })
    lastChangedBy: string;

    @Column({ type: 'varchar', length: 300, nullable: true })
    internalComment: string | null;
}
```
 and `item.entity.ts`
```typescript 
import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'item' })
export class Item extends BaseEntity {

  @Column({ type: 'varchar', length: 300 })
  name: string;

  @Column({ type: 'varchar', length: 300 })
  description: string;

}
```

## Party time - Let’s start our API and see if it works. 

start the db server 
```bash 
npm start:dev:db
```

start the api server
```bash
npm run start:dev
```

... cool - that seems to work, but actually our database does not reflect our data model jet. 

## Apply the Schema, generate and run database migrations 

As mentioned earlier, TypeORM is able to synchronize your data model into tables in your database. 
This synchronization of the model is nice, but also dangerous.

Why? In early development it’s great - you don’t have all your data models figured out jet. So, you change the Model in code, and all just works out nicely on the database. Basically, you don’t have to think about the state your database is in that much. 

But here comes the tricky part. Once you have actual data in your database you do not want to lose on every model change it get a bit more complicated. This sync works in a way, that it would to apply the necessary changes to your database tables by drop and recreating them. Meaning you lose the data inside the table. What of cause in production you should avoid.

That's why i prefer to work with propper database migrations in code straight from the beginning. 
So lets handle this - lucky TypeORM comes with a solution and a CLI for this. 

Here is how to set that CLI up nicely. 
we have already added all nessesary config with our `configService`, 
but the typeORM CLI works with an `ormconfig.json` where it expects the correct config to be in. 

lets add a quick helper script to write the file and add it to our `.gitignore`-list, 
as we will generate it before using the CLI.

helper script `src/scripts/write-type-orm-config.ts`: 
```typescript
import { configService } from '../config/config.service';
import fs = require('fs');
fs.writeFileSync(
  'ormconfig.json',
  JSON.stringify(configService.getTypeOrmConfig(), null, 2)
);
```

and lets add a npm script task to run it.
```json
{
  "pretypeorm": "(rm ormconfig.json || :) && ts-node -r tsconfig-paths/register src/scripts/write-type-orm-config.ts",
}
```

<--- WIP --->

## Debugging the database 

Cool, it does not crash - but does our database actually reflect our data model? 
We can check this by running some cli queries against the DB or using a database management tool for quick debugging. 

When working with postgres database I use <tool>

It’s a pretty powerful tool with a nice UI to see what’s going on. However, I would recommend you the following workflow:

Avoid „manual changes” on your database using tools, rather apply code changes in your project to reflect this in the database. Why? Because this is reproducible, and you have less chances running into „well it works on my machine but does not on another one“.

Okay nice - we can now see that our tables got created in the database.

Let’s add some business logic now. Just for demo I’ll just add a simple endpoint that will return the data in the table. 

For this will add a DTO response module that will be filled by the data model entity.

I would always recommend this setup. So, you have a clear distinction between your internal data model (API to Database) and your external model (API-consumer to API).

This will help you decouple things and make maintenance Easier in the long run. This also enable you to generate an API documentation (open API aka swagger doc) from these DTOs. See how that works in NestJS here 

<link> 

This is how a simple service and response DTO could look like. 

<code> 

## Defining a seed script. 

We have nearly everything we need to scale our project with fancy business logic now. What will really boost your and your team’s productivity when working on the project is a data seed script. 

This is a script that will setup your database with test data. Remember we added a script that automatically create a database server and an empty database ready to use. Now we add a script that will generate „meaningful data“ in that database. This helps with local development (as everybody works locally on the same dataset, but also with running integration tests against a standing system as you kind of know what the state of your persistence should be) 

We write the script in a way that is uses our already defined model. Because in the inversion of control of the dependency injection in NestJS we can create instances of our repositories and services from our project kind of manually without starting an API Server. This is pretty neat as this kind of dry run tests your code, as well as you are able to run the seed process in stand-alone before your launch your actual server. So, you seed script logic does not bleed into your actual business logic code. I usually write my seed scripts in a very generic way, so it works stand alone in a single run, not depending on anything else with randomizing the values it puts in with a random value. This is nice, because then you can run the script over and over again producing more data. 

To establish the database connection in our script we will just reuse the config service we have written and run it using the ts-node module. 


This is how a seed script could look like:

<seed script> 

You can now add an NPM script task you can either run right after the DB setup script and before the server start or on its own to create more data. 


Run migrations on start with flag.