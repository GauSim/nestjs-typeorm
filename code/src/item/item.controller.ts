import { Controller, Get } from '@nestjs/common';
import { ItemService } from './item.service';
import { ItemDTO } from './item.dto';

@Controller('item')
export class ItemController {
  constructor(private serv: ItemService) {

  }

  @Get()
  public async getAll(): Promise<ItemDTO[]> {
    return await this.serv.getAll()
      .then(items => items.map(it => ItemDTO.fromEntity(it)));
  }
}
