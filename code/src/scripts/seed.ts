import * as _ from 'lodash';
import { createConnection, ConnectionOptions } from 'typeorm';
import { configService } from '../config/config.service';
import { User } from '../user.decorator';
import { ItemService } from '../item/item.service';
import { Item } from '../model/item.entity';
import { ItemDTO } from '../item/item.dto';

async function run() {

  const seedUser: User = { id: 'seed-user' };

  const seedId = Date.now()
    .toString()
    .split('')
    .reverse()
    .reduce((s, it, x) => (x > 3 ? s : (s += it)), '');

  const opt = {
    ...configService.getTypeOrmConfig(),
    debug: true
  };

  const connection = await createConnection(opt as ConnectionOptions);
  const itemService = new ItemService(connection.getRepository(Item));

  const work = _.range(1, 10)
    .map(n => ItemDTO.from({
      name: `seed${seedId}-${n}`,
      description: 'created from seed'
    }))
    .map(dto => itemService.create(dto, seedUser)
      .then(r => (console.log('done ->', r.name), r)))

  return await Promise.all(work);

}

run()
  .then(_ => console.log('...wait for script to exit'))
  .catch(error => console.error('seed error', error));
