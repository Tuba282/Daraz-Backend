/**
 * ApiFeatures — Chainable query builder for filtering, sorting, field selection, and pagination.
 *
 * Usage:
 *   const features = new ApiFeatures(Product.find(), req.query)
 *     .filter()
 *     .search()
 *     .sort()
 *     .limitFields()
 *     .paginate();
 *   const products = await features.query;
 */
class ApiFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  // Basic filtering (e.g., ?category=xyz&price[gte]=100&price[lte]=500)
  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach((field) => delete queryObj[field]);

    // Advanced filtering: convert operators to MongoDB syntax
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  // Full-text search (e.g., ?search=shoes)
  search(fields = []) {
    if (this.queryString.search) {
      const keyword = this.queryString.search.trim();
      if (fields.length > 0) {
        const searchQuery = fields.map((field) => ({
          [field]: { $regex: keyword, $options: 'i' },
        }));
        this.query = this.query.find({ $or: searchQuery });
      } else {
        // Use MongoDB text index
        this.query = this.query.find({ $text: { $search: keyword } });
      }
    }
    return this;
  }

  // Sorting (e.g., ?sort=price,-rating)
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  // Field projection (e.g., ?fields=name,price,category)
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  // Pagination (e.g., ?page=2&limit=20)
  paginate() {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = Math.min(parseInt(this.queryString.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    this.page = page;
    this.limit = limit;
    return this;
  }
}

module.exports = ApiFeatures;
