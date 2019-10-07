import { ApiModelProperty } from '@nestjs/swagger';
import { IsString, IsUUID, } from 'class-validator';
import { Item } from '../model/item.entity';

export class ItemDTO implements Readonly<ItemDTO> {
  @ApiModelProperty({ required: true })
  @IsUUID()
  id: string;


  @ApiModelProperty({ required: true })
  @IsString()
  name: string;

  public static fromEntity(entity: Item) {
    const it = new ItemDTO();
    it.id = entity.id;
    it.name = entity.name;
    return it;
  }
}