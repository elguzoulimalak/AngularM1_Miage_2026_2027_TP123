/** Doublure d'une requête Mongoose chaînable : find().sort().populate()...lean(). */
export function fakeQuery(result) {
  const query = {
    calls: {},
    lean: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  for (const name of ["sort", "skip", "limit", "select", "populate"]) {
    query[name] = (arg) => {
      query.calls[name] = [...(query.calls[name] ?? []), arg];
      return query;
    };
  }
  return query;
}
