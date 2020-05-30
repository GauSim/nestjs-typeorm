import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Item } from '../model/item.entity';
import { Repository } from 'typeorm';
import { ItemDTO } from './item.dto';
import { User } from '../user.decorator';

@Injectable()
export class ItemService {
  constructor(
    @InjectRepository(Item) private readonly repo: Repository<Item>,
  ) { }

  public async getAll(): Promise<ItemDTO[]> {
    return await this.repo.find()
      .then(items => items.map(e => ItemDTO.fromEntity(e)));
  }

  public async create(dto: ItemDTO, user: User): Promise<ItemDTO> {
    return this.repo.save(ItemDTO.toEntity(dto, user))
      .then(e => ItemDTO.fromEntity(e));
  }
}
