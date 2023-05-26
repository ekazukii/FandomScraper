import jsdom from "jsdom";

import { IData, IDataSource, ISchema } from './interfaces';
import { Schemas } from './schemas';
import { TAvailableWikis } from './types';

import { allCharactersPage } from './utils/';
import { removeBrackets } from './func/parsing';

/**
 * The constructor options.
 * @typedef {Object} IConstructor
 * @property {TAvailableWikis} name - The name of the fiction you want to scrape from the Fandom wiki (ex: 'dragon-ball')
 * @property {'en' | 'fr' | null} [language] - The language of the wiki you want to scrape from the Fandom wiki (optional). Default: 'en'
 * @throws Error if an invalid wiki name is provided.
 */
interface IConstructor {
    /**
     * The name of the fiction you want to scrape from the Fandom wiki (ex: 'dragon-ball')
     */
    name: TAvailableWikis;

    /**
     * The language of the wiki you want to scrape from the Fandom wiki (optional). Default: 'en'
     */
    language?: 'en' | 'fr' | null;
};

interface IGetCharactersOptions {
    
    /**
     * The limit of characters to get (optional). Default: 100000
     */
    limit: number;

    /**
     * The offset of characters to get (optional). Default: 0
     */
    offset: number;

    /**
     * If the scraper should get all the characters recursively (optional). Default: false
     */
    recursive?: boolean;

    /**
     * If the scraper should get the images in base64 (optional). Default: false
     */
    base64?: boolean;

    /**
     * If the scraper should get the id of the character (optional). The id is the pageId of the wikia. Default: false
     */
    withId?: boolean;
};

/**
 * FandomScraper is a class that allows you to scrape a Fandom wiki, and get all the characters of a fiction.
 * The list of available wikis can be found in the TAvailableWikis type.
 */
export class FandomScraper {

    private _schema: ISchema;
    private _CharactersPage!: Document;

    /**
     * Constructs a FandomScraper instance.
     * @param {IConstructor} constructor - The constructor options.
     * @throws Error if an invalid wiki name is provided.
     * @example
     * ```js
     * const scraper = new FandomScraper({ name: 'dragon-ball', language: 'fr' });
     * ```
     */
    constructor(constructor: IConstructor) {
        // check if constructor.name is a valid wiki
        if (!this.isValidConstructor(constructor)) 
            throw new Error(`Invalid wiki name: ${constructor.name}`);
        if (constructor.language == null) constructor.language = 'en';
        this._schema = Schemas[constructor.name][constructor.language];
    }


    /**
     * Get the schema of the current wiki.
     * @returns The schema of the wiki.
     */
    public getSchema(): ISchema {
        return this._schema;
    }



    /**
     * Get the characters page of the current wiki.
     *  
     * @param url - The url of the characters page.
     * @returns The characters page of the wiki.
     * @throws Error if the characters page is not set.
     * @example
     * ```js
     * const scraper = new FandomScraper({ name: 'dragon-ball' });
     * await scraper.getCharactersPage('https://kimetsu-no-yaiba.fandom.com/fr/wiki/Catégorie:Personnages');
     * ```
     */
    public async getCharactersPage(url: string): Promise<void> {
        this._CharactersPage = await this.fetchPage(url);
    }

    public async fetchPage(url: string): Promise<Document> {
        const text = await fetch(url).then(async res => {
            return await res.text();
        }).catch(err => {
            throw new Error(`Error while fetching ${url}: ${err}`);
        }) as unknown as string;

        return new jsdom.JSDOM(text , { url: url, contentType: "text/html", referrer: url }).window.document;
    }


    /**
     * Get all the characters of the current wiki, considering the options provided.
     * @param {IGetCharactersOptions} [options] - The options of the getCharacters method.
     * @returns The characters of the wiki.
     * @throws Error if the limit is less than 1.
     * @throws Error if the offset is less than 0.
     * @throws Error if the offset is greater than the limit.
     * @example
     * ```js
     * const scraper = new FandomScraper({ name: 'dragon-ball' });
     * const characters = await scraper.getCharacters({ limit: 100, offset: 0 });
     * ```
     * @example
     * ```js
     * const scraper = new FandomScraper({ name: 'dragon-ball' });
     * const characters = await scraper.getCharacters({ limit: 100, offset: 0, recursive: true, base64: true, withId: true });
     * ```
     */
    public async getAll(options: IGetCharactersOptions = { offset: 0, limit: 100000, recursive: false, base64: true, withId: true }): Promise<any[]> {
        try {
            if (options.limit < 1) throw new Error('Limit must be greater than 0');
            if (options.offset < 0) throw new Error('Offset must be greater than 0');
            if (options.offset > options.limit) throw new Error('Offset must be less than limit');

            if (this._schema.pageFormat === 'classic') {
                return await this._getAllClassic(options);
            } else if (this._schema.pageFormat === 'table-1') {
                // parse in the table-1 way
            } else if (this._schema.pageFormat === 'table-2') {
                // parse in the table-2 way
            }
        } catch (err) {
            console.error(err);
        }
        return [];
    };

    private async _getAllClassic(options: IGetCharactersOptions): Promise<any[]> {
        const data: IData[] = [];
        const pageElement = allCharactersPage.classic.listCharactersElement;
        let hasNext = true;
        let offset = 0;
        let count = 0;
        await this.getCharactersPage(this._schema.charactersUrl);

        while (hasNext && count < options.limit) {
            const elements = this.filterBannedElement(this._CharactersPage.getElementsByClassName(pageElement.value), allCharactersPage.classic.banList);
            for (const element of elements) {
                var characterData = {};
                if (offset >= options.offset) {
                    const url = element.getAttribute('href');
                    if (!url) throw new Error('No URL found');
            
                    const name = element.textContent;
                    if (!name) throw new Error('No name found');

                    const characterPage = await this.fetchPage(new URL(url, this._schema.url).href);
                    if (options.recursive) {
                        characterData = await this.parseCharacterPage(characterPage, options);
                    }

                    if (options.withId) {
                        const allScripts = characterPage.getElementsByTagName('script');
                        const script = Array.from(allScripts).find(script => script.textContent?.includes('pageId'));
                        
                        const id: number = this.extractPageId(script?.textContent || '');
                        data.push({ id: id, url: url, name: name, data: characterData });
                    } else {
                        data.push({ url: url, name: name, data: characterData });
                    }

                    count++;
                    
                    if (!options.recursive) {
                        data[data.length - 1].data = undefined;
                    }

                    if (count == options.limit) {
                        return data; // Return the data when the limit is reached
                    }
                }
                offset++;
            }
          
            // Change the characters page according to the next button
            const nextElement = this._CharactersPage.getElementsByClassName(allCharactersPage.classic.next.value)[0];
            if (!nextElement) {
                hasNext = false;
            } else {
                const nextUrl = nextElement.getAttribute('href');
                if (!nextUrl) {
                    hasNext = false;
                } else {
                    await this.getCharactersPage(nextUrl);
                }
            }
        }
          
        return data;
    }

    private async parseCharacterPage(page: Document, options: IGetCharactersOptions): Promise<any> {
        const format: IDataSource = this._schema.dataSource;
        const data: any = {};
        // for each key in format, get the value from the page according to the attribute data-source=key and get the value
        for (const key in format) {
            if (Object.prototype.hasOwnProperty.call(format, key)) {
                const sourceKey = format[key as keyof IDataSource];
                if (!sourceKey) {
                    continue;
                }

                if (key === "images") {
                    // get the elements with the classname sourceKey
                    const elements = page.getElementsByClassName(sourceKey);
                    if (!elements) { 
                        continue;
                    }

                    const images: string[] = [];
                    for (const element of elements) {
                        // get src attribute
                        const src = element.getAttribute('src');
                        if (!src) { 
                            console.error(`No src found for key ${key}`);
                            continue;
                        }
                        if (options.base64) {
                            const b64 = await this.convertImageToBase64(src);
                            images.push(b64);
                        } else {
                            images.push(src);
                        }
                    }
                    data[key] = images;
                }

                const element = page.querySelector(`[data-source="${sourceKey}"]`);
                if (!element) {
                    continue;
                }

                // get the element with the classname pi-data-value inside the element
                const valueElement = element.getElementsByClassName('pi-data-value')[0];
                if (!valueElement) {
                    continue;
                }

                // get the value from the value element
                const value: string | null = valueElement.textContent;
                if (!value) {
                    continue;
                }
                
                data[key] = removeBrackets(value);
            }
        }
        return data;
    }

    /**
     * Convert the image from the given URL to a base64 string
     * Due to somes issues about CORS, this method is sometimes necessary to print the image in your application
     * @param imageUrl The URL of the image to convert
     * @returns The base64 string of the image
     * @throws An error if the image cannot be fetched or converted
     */
    private async convertImageToBase64(imageUrl: string) {
        try {
            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString('base64');
            return base64Image;        
        } catch (error) {
            console.error('Error fetching or converting image:', error);
            throw error;
        }
    }
    

    private filterBannedElement(elements: HTMLCollectionOf<Element>, banList: string[]): Element[] {
        const elementsArray = Array.from(elements);
        return elementsArray.filter((element) => {
            const innerText = element.textContent?.toLowerCase() ?? '';
            return !banList.some((substring) => innerText.includes(substring.toLowerCase()));
        });
    }

    private extractPageId(scriptContent: string): number {
        const regex = /"pageId":(\d+)/;
        const match = scriptContent.match(regex);
        if (match && match.length > 1) {
            return parseInt(match[1], 10);
        }
        return 0;
    }

    // Helper function to validate the constructor object
    private isValidConstructor(constructor: IConstructor): boolean {
        // Add your validation logic here
        // Return true if the constructor object is valid, false otherwise
        return !!constructor.name;
    }

}