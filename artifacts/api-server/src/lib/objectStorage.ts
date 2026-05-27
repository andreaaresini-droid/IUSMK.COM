/**
 * Stub — il sistema di storage è stato migrato a Cloudinary.
 * Questo file è mantenuto solo per non rompere eventuali import rimasti,
 * ma non contiene più dipendenze da @google-cloud/storage.
 */

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}
