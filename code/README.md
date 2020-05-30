## Demo code

Run: 
```sh
npm i

npm run start:dev:db

npm run typeorm:migration:run

npm run start:dev:db:seed

npm run start:dev
```

then to read
```sh
curl --location --request GET 'http://localhost:3000/item'
```

or to write 
```sh
curl --location --request POST 'http://localhost:3000/item' \
--header 'Content-Type: application/json' \
--data-raw '{
        "name": "ItemDTO",
        "description": "Some Test Item"
    }'
```