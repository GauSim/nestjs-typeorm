import { Controller, Get, Post, Body } from '@nestjs/common';
import { ItemService } from './item.service';
import { ItemDTO } from './item.dto';
import { User } from '../user.decorator';

@Controller('item')
export class ItemController {
  constructor(private serv: ItemService) { }

  @Get()
  public async getAll(): Promise<ItemDTO[]> {
    return await this.serv.getAll()
  }

  @Post()
  public async post(@User() user: User, @Body() dto: ItemDTO): Promise<ItemDTO> {
    return this.serv.create(dto, user);
  }

}
