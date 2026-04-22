abstract class UC<I, O> { abstract execute(i: I): O }
class R extends UC<string, number> { execute(x) { return 0 } }
