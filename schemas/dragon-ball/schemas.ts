import { ISchema } from "../../interfaces";
import { DragonBallFRDataSource, DragonBallENDataSource } from "./data-source";

const DragonBallFR: ISchema = {
    name: 'dragon-ball',
    url: 'https://dragonball.fandom.com/fr/wiki/',
    pageFormat: 'classic',
    charactersUrl: 'https://dragonball.fandom.com/fr/wiki/Catégorie:Personnages',
    dataSource: DragonBallFRDataSource
};

const DragonBallEN: ISchema = {
    name: 'dragon-ball',
    url: 'https://dragonball.fandom.com/wiki/',
    pageFormat: 'classic',
    charactersUrl: 'https://dragonball.fandom.com/wiki/Characters',
    dataSource: DragonBallENDataSource
};

export { DragonBallFR, DragonBallEN };